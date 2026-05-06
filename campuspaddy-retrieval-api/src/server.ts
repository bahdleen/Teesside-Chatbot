import "dotenv/config";
import express from "express";
import cors from "cors";
import { db } from "./db";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = Number(process.env.PORT || 3011);
const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.1:8b";
const API_KEY = process.env.API_KEY || "";
const DEFAULT_LIMIT = Number(process.env.DEFAULT_RETRIEVAL_LIMIT || 3);
const MAX_LIMIT = Number(process.env.MAX_RETRIEVAL_LIMIT || 5);
const CHUNK_CONTEXT_CHARS = Number(process.env.CHUNK_CONTEXT_CHARS || 1000);
const OLLAMA_NUM_CTX = Number(process.env.OLLAMA_NUM_CTX || 4096);
const OLLAMA_NUM_PREDICT = Number(process.env.OLLAMA_NUM_PREDICT || 150);
const OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS || 60000);

type RetrievedChunk = { title: string | null; url: string; source_type: string; chunk_index: number; chunk_text: string; score: number; };

app.use((req, res, next) => {
  if (!API_KEY) return next();
  if (["/health", "/ollama/health"].includes(req.path)) return next();
  if (req.header("x-api-key") !== API_KEY) return res.status(401).json({ ok: false, error: "Unauthorized" });
  next();
});

function cleanQuestion(question: unknown) { if (typeof question !== "string") return ""; return question.replace(/\s+/g, " ").trim().slice(0, 1000); }
function clampLimit(value: unknown) { const parsed = Number(value || DEFAULT_LIMIT); if (Number.isNaN(parsed)) return DEFAULT_LIMIT; return Math.min(Math.max(parsed, 1), MAX_LIMIT); }
function normalizeCacheQuestion(question: string) { return question.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim(); }
function extractFallbackTerms(question: string) { const stopwords = new Set(["a","an","and","are","as","at","be","by","can","could","do","does","for","from","get","how","i","in","is","it","me","my","of","on","or","please","the","to","what","when","where","who","why","with","you","your"]); return question.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).map((term)=>term.trim()).filter((term)=>term.length>=3 && !stopwords.has(term)).slice(0,8); }
function buildContext(chunks: RetrievedChunk[]) { return chunks.map((chunk,index)=>[`SOURCE ${index+1}`,`Title: ${chunk.title || "Untitled"}`,`URL: ${chunk.url}`,`Type: ${chunk.source_type}`,`Content:`,chunk.chunk_text.slice(0,CHUNK_CONTEXT_CHARS)].join("\n")).join("\n\n---\n\n"); }
function buildSources(chunks: RetrievedChunk[]) { const seen = new Set<string>(); return chunks.filter((chunk)=>{ if(seen.has(chunk.url)) return false; seen.add(chunk.url); return true; }).map((chunk,index)=>({ number:index+1, title: chunk.title || "Source", url: chunk.url, source_type: chunk.source_type })); }
function diversifyChunks(chunks: RetrievedChunk[], limit: number) { const selected: RetrievedChunk[] = []; const countByUrl = new Map<string, number>(); for (const chunk of chunks) { const currentCount = countByUrl.get(chunk.url) || 0; if (currentCount >= 2) continue; selected.push(chunk); countByUrl.set(chunk.url, currentCount + 1); if (selected.length >= limit) break; } return selected; }

async function ensureCacheTable() {
  await db.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
  await db.query(`CREATE TABLE IF NOT EXISTS public.chatbot_cached_answers (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), university_domain TEXT NOT NULL DEFAULT 'tees.ac.uk', normalized_question TEXT NOT NULL, original_question TEXT NOT NULL, answer TEXT NOT NULL, sources JSONB NOT NULL DEFAULT '[]'::jsonb, model TEXT, retrieval_count INT DEFAULT 0, hit_count INT DEFAULT 0, is_active BOOLEAN DEFAULT true, expires_at TIMESTAMPTZ DEFAULT now() + interval '14 days', created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(), last_hit_at TIMESTAMPTZ, UNIQUE (university_domain, normalized_question));`);
  await db.query(`CREATE INDEX IF NOT EXISTS chatbot_cached_answers_lookup_idx ON public.chatbot_cached_answers (university_domain, normalized_question, is_active, expires_at);`);
}
async function ensureSearchColumnsExist() {
  const result = await db.query(`SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='knowledge_chunks' AND column_name='chunk_search_vector') AS has_chunk_search_vector, EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='knowledge_sources' AND column_name='source_search_vector') AS has_source_search_vector;`);
  const row = result.rows[0];
  if (!row.has_chunk_search_vector || !row.has_source_search_vector) console.warn("WARNING: Optimized search columns are missing. Run: npm run optimize:search");
}
async function getCachedAnswer(params: { question: string; universityDomain: string }) {
  const normalizedQuestion = normalizeCacheQuestion(params.question);
  const result = await db.query(`SELECT id, answer, sources, model, retrieval_count, hit_count FROM public.chatbot_cached_answers WHERE university_domain=$1 AND normalized_question=$2 AND is_active=true AND expires_at > now() LIMIT 1;`, [params.universityDomain, normalizedQuestion]);
  const cached = result.rows[0]; if (!cached) return null;
  await db.query(`UPDATE public.chatbot_cached_answers SET hit_count=hit_count+1, last_hit_at=now(), updated_at=now() WHERE id=$1;`, [cached.id]);
  return cached;
}
async function saveCachedAnswer(params: { universityDomain: string; question: string; answer: string; sources: any[]; model: string; retrievalCount: number }) {
  const normalizedQuestion = normalizeCacheQuestion(params.question);
  if (!params.answer || params.answer.length < 20) return;
  if (params.answer.toLowerCase().includes("i could not find that in the teesside university information")) return;
  await db.query(`INSERT INTO public.chatbot_cached_answers (university_domain, normalized_question, original_question, answer, sources, model, retrieval_count, expires_at) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7, now()+interval '14 days') ON CONFLICT (university_domain, normalized_question) DO UPDATE SET answer=EXCLUDED.answer, sources=EXCLUDED.sources, model=EXCLUDED.model, retrieval_count=EXCLUDED.retrieval_count, expires_at=EXCLUDED.expires_at, is_active=true, updated_at=now();`, [params.universityDomain, normalizedQuestion, params.question, params.answer, JSON.stringify(params.sources), params.model, params.retrievalCount]);
}

async function retrieveWithFullTextSearch(params: { question: string; limit: number; universityDomain: string }) {
  const candidateLimit = Math.max(params.limit * 6, 18);
  const result = await db.query<RetrievedChunk>(`
    WITH selected_university AS (SELECT id FROM public.universities WHERE domain=$3 LIMIT 1), search_query AS (SELECT websearch_to_tsquery('english',$1) AS query)
    SELECT ks.title, ks.url, ks.source_type, kc.chunk_index, kc.chunk_text,
      (ts_rank_cd(kc.chunk_search_vector, search_query.query) * 1.0 + ts_rank_cd(ks.source_search_vector, search_query.query) * 2.5 + CASE WHEN ks.url ILIKE '%/sections/stud/%' THEN 0.08 WHEN ks.url ILIKE '%/currentstudents/%' THEN 0.08 WHEN ks.url ILIKE '%/sections/accommodation/%' THEN 0.08 WHEN ks.url ILIKE '%/sections/support/%' THEN 0.06 WHEN ks.url ILIKE '%/docs/docrepo/student%' THEN 0.04 ELSE 0 END)::float AS score
    FROM public.knowledge_chunks kc JOIN public.knowledge_sources ks ON ks.id=kc.source_id JOIN selected_university su ON su.id=kc.university_id CROSS JOIN search_query
    WHERE ks.status='processed' AND (kc.chunk_search_vector @@ search_query.query OR ks.source_search_vector @@ search_query.query)
    ORDER BY score DESC, LENGTH(kc.chunk_text) DESC LIMIT $2;`, [params.question, candidateLimit, params.universityDomain]);
  return diversifyChunks(result.rows, params.limit);
}
async function retrieveWithKeywordFallback(params: { question: string; limit: number; universityDomain: string }) {
  const terms = extractFallbackTerms(params.question); if (terms.length === 0) return [];
  const candidateLimit = Math.max(params.limit * 6, 18);
  const chunkConditions = terms.map((_, index)=>`kc.chunk_text ILIKE $${index+4}`).join(" OR ");
  const titleConditions = terms.map((_, index)=>`ks.title ILIKE $${index+4}`).join(" OR ");
  const urlConditions = terms.map((_, index)=>`ks.url ILIKE $${index+4}`).join(" OR ");
  const values = [params.universityDomain, params.limit, candidateLimit, ...terms.map((term)=>`%${term}%`)];
  const result = await db.query<RetrievedChunk>(`
    WITH selected_university AS (SELECT id FROM public.universities WHERE domain=$1 LIMIT 1)
    SELECT ks.title, ks.url, ks.source_type, kc.chunk_index, kc.chunk_text, (CASE WHEN (${titleConditions}) THEN 0.5 ELSE 0 END + CASE WHEN (${urlConditions}) THEN 0.3 ELSE 0 END + CASE WHEN (${chunkConditions}) THEN 0.1 ELSE 0 END)::float AS score
    FROM public.knowledge_chunks kc JOIN public.knowledge_sources ks ON ks.id=kc.source_id JOIN selected_university su ON su.id=kc.university_id
    WHERE ks.status='processed' AND (${chunkConditions} OR ${titleConditions} OR ${urlConditions})
    ORDER BY score DESC, LENGTH(kc.chunk_text) DESC LIMIT $3;`, values);
  return diversifyChunks(result.rows, params.limit);
}
async function retrieveRelevantChunks(params: { question: string; limit: number; universityDomain: string }) { let chunks = await retrieveWithFullTextSearch(params); if (chunks.length === 0) chunks = await retrieveWithKeywordFallback(params); return chunks; }
async function askOllama(params: { question: string; chunks: RetrievedChunk[] }) {
  const context = buildContext(params.chunks);
  const systemPrompt = `You are CampusPaddy, a friendly Teesside University student companion.\n\nAnswer using ONLY the provided Teesside University context.\n\nRules:\n- Be clear, helpful, and concise.\n- Prefer short answers unless the student asks for detail.\n- Do not invent information.\n- Do not answer from general knowledge when the answer is not in the provided context.\n- If the context does not contain the answer, say: "I could not find that in the Teesside University information I have."\n- Mention source numbers like [Source 1] when useful.\n- For urgent mental health, safety, medical, legal, immigration, or financial hardship issues, encourage the student to contact the relevant university support service or emergency services where appropriate.`;
  const userPrompt = `Student question:\n${params.question}\n\nTeesside University context:\n${context}\n\nAnswer in 3-6 concise sentences where possible:`;
  const controller = new AbortController(); const timeout = setTimeout(()=>controller.abort(), OLLAMA_TIMEOUT_MS);
  try {
    const response = await fetch(`${OLLAMA_URL}/api/chat`, { method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: OLLAMA_MODEL, stream: false, keep_alive: "24h", messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }], options: { temperature: 0.2, top_p: 0.9, num_ctx: OLLAMA_NUM_CTX, num_predict: OLLAMA_NUM_PREDICT } }) });
    if (!response.ok) throw new Error(`Ollama error ${response.status}: ${await response.text()}`);
    const data: any = await response.json();
    return { answer: data.message?.content || "", model: data.model || OLLAMA_MODEL, total_duration: data.total_duration, load_duration: data.load_duration, prompt_eval_count: data.prompt_eval_count, eval_count: data.eval_count };
  } finally { clearTimeout(timeout); }
}

app.get("/health", async (_req, res) => {
  try {
    const dbCheck = await db.query(`SELECT now() AS database_time, (SELECT COUNT(*)::int FROM public.knowledge_chunks) AS total_chunks, (SELECT COUNT(*)::int FROM public.knowledge_sources WHERE status='processed') AS processed_sources, (SELECT COUNT(*)::int FROM public.chatbot_cached_answers WHERE is_active=true) AS active_cached_answers;`);
    const searchColumnCheck = await db.query(`SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='knowledge_chunks' AND column_name='chunk_search_vector') AS has_chunk_search_vector, EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='knowledge_sources' AND column_name='source_search_vector') AS has_source_search_vector;`);
    res.json({ ok: true, service: "campuspaddy-retrieval-ai", ollama_url: OLLAMA_URL, ollama_model: OLLAMA_MODEL, auth_enabled: Boolean(API_KEY), defaults: { default_limit: DEFAULT_LIMIT, max_limit: MAX_LIMIT, chunk_context_chars: CHUNK_CONTEXT_CHARS, ollama_num_ctx: OLLAMA_NUM_CTX, ollama_num_predict: OLLAMA_NUM_PREDICT }, optimized_search: searchColumnCheck.rows[0], database_time: dbCheck.rows[0].database_time, total_chunks: dbCheck.rows[0].total_chunks, processed_sources: dbCheck.rows[0].processed_sources, active_cached_answers: dbCheck.rows[0].active_cached_answers });
  } catch (error: any) { res.status(500).json({ ok: false, error: error.message }); }
});
app.get("/ollama/health", async (_req, res) => { try { const response = await fetch(`${OLLAMA_URL}/api/tags`); if (!response.ok) return res.status(500).json({ ok:false, error:`Ollama returned ${response.status}` }); const data:any=await response.json(); res.json({ ok:true, ollama_url: OLLAMA_URL, selected_model: OLLAMA_MODEL, available_models: data.models?.map((model:any)=>model.name)||[] }); } catch(error:any){ res.status(500).json({ok:false,error:error.message}); } });
app.get("/cache/stats", async (_req, res) => { try { const result=await db.query(`SELECT COUNT(*)::int AS total_cached_answers, COUNT(*) FILTER (WHERE is_active=true AND expires_at>now())::int AS active_cached_answers, COALESCE(SUM(hit_count),0)::int AS total_cache_hits FROM public.chatbot_cached_answers;`); const recent=await db.query(`SELECT original_question, hit_count, expires_at, updated_at FROM public.chatbot_cached_answers ORDER BY updated_at DESC LIMIT 10;`); res.json({ ok:true, stats: result.rows[0], recent: recent.rows }); } catch(error:any){ res.status(500).json({ ok:false, error:error.message }); } });
app.post("/cache/clear", async (req,res)=>{ try{ const question=cleanQuestion(req.body.question); const universityDomain=req.body.universityDomain||"tees.ac.uk"; if(!question) return res.status(400).json({ok:false,error:"question is required"}); const result=await db.query(`UPDATE public.chatbot_cached_answers SET is_active=false, updated_at=now() WHERE university_domain=$1 AND normalized_question=$2 RETURNING id;`, [universityDomain, normalizeCacheQuestion(question)]); res.json({ok:true,disabled_count:result.rowCount}); } catch(error:any){ res.status(500).json({ok:false,error:error.message}); } });
app.post("/retrieve", async (req,res)=>{ try{ const question=cleanQuestion(req.body.question); const limit=clampLimit(req.body.limit); const universityDomain=req.body.universityDomain||"tees.ac.uk"; if(!question) return res.status(400).json({ok:false,error:"question is required"}); const startedAt=Date.now(); const chunks=await retrieveRelevantChunks({question,limit,universityDomain}); res.json({ok:true,question,universityDomain,count:chunks.length,duration_ms:Date.now()-startedAt,chunks:chunks.map((chunk)=>({title:chunk.title,url:chunk.url,source_type:chunk.source_type,chunk_index:chunk.chunk_index,score:chunk.score,text:chunk.chunk_text}))}); } catch(error:any){ console.error(error); res.status(500).json({ok:false,error:error.message||"Internal server error"}); } });
app.post("/ask", async (req,res)=>{ try{ const question=cleanQuestion(req.body.question); const limit=clampLimit(req.body.limit || DEFAULT_LIMIT); const universityDomain=req.body.universityDomain||"tees.ac.uk"; const useCache=req.body.useCache!==false; if(!question) return res.status(400).json({ok:false,error:"question is required"}); const startedAt=Date.now(); if(useCache){ const cached=await getCachedAnswer({question,universityDomain}); if(cached) return res.json({ok:true,cached:true,question,answer:cached.answer,sources:cached.sources,retrieval_count:cached.retrieval_count,model:cached.model,duration_ms:Date.now()-startedAt}); } const retrievalStartedAt=Date.now(); const chunks=await retrieveRelevantChunks({question,limit,universityDomain}); const retrievalDurationMs=Date.now()-retrievalStartedAt; if(chunks.length===0) return res.json({ok:true,cached:false,question,answer:"I could not find that in the Teesside University information I have.",sources:[],retrieval_count:0,model:OLLAMA_MODEL,duration_ms:Date.now()-startedAt,retrieval_duration_ms:retrievalDurationMs}); const ollamaStartedAt=Date.now(); const ollamaResult=await askOllama({question,chunks}); const ollamaDurationMs=Date.now()-ollamaStartedAt; const sources=buildSources(chunks); if(useCache) await saveCachedAnswer({universityDomain,question,answer:ollamaResult.answer,sources,model:ollamaResult.model,retrievalCount:chunks.length}); res.json({ok:true,cached:false,question,answer:ollamaResult.answer,sources,retrieval_count:chunks.length,model:ollamaResult.model,duration_ms:Date.now()-startedAt,retrieval_duration_ms:retrievalDurationMs,ollama_duration_ms:ollamaDurationMs,settings:{limit,chunk_context_chars:CHUNK_CONTEXT_CHARS,num_ctx:OLLAMA_NUM_CTX,num_predict:OLLAMA_NUM_PREDICT},ollama_metrics:{total_duration:ollamaResult.total_duration,load_duration:ollamaResult.load_duration,prompt_eval_count:ollamaResult.prompt_eval_count,eval_count:ollamaResult.eval_count}}); } catch(error:any){ console.error(error); res.status(500).json({ok:false,error:error.message||"Internal server error"}); } });

async function startServer() { await ensureCacheTable(); await ensureSearchColumnsExist(); app.listen(PORT, "127.0.0.1", () => { console.log(`CampusPaddy API running on http://127.0.0.1:${PORT}`); console.log(`Using Ollama model: ${OLLAMA_MODEL}`); console.log(`Default retrieval limit: ${DEFAULT_LIMIT}`); console.log(`Chunk context chars: ${CHUNK_CONTEXT_CHARS}`); console.log(`Ollama num_predict: ${OLLAMA_NUM_PREDICT}`); }); }
startServer().catch(async (error) => { console.error("Failed to start server:"); console.error(error); await db.end(); process.exit(1); });
