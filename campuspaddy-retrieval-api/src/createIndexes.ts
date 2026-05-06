import "dotenv/config";
import { db } from "./db";

async function main() {
  console.log("Creating indexes if missing...");
  await db.query(`CREATE INDEX IF NOT EXISTS knowledge_chunks_text_fts_idx ON public.knowledge_chunks USING GIN (to_tsvector('english', chunk_text));`);
  await db.query(`CREATE INDEX IF NOT EXISTS knowledge_chunks_university_idx ON public.knowledge_chunks (university_id);`);
  await db.query(`CREATE INDEX IF NOT EXISTS knowledge_chunks_source_idx ON public.knowledge_chunks (source_id);`);
  await db.query(`CREATE INDEX IF NOT EXISTS knowledge_sources_status_idx ON public.knowledge_sources (status);`);
  await db.query(`CREATE INDEX IF NOT EXISTS universities_domain_idx ON public.universities (domain);`);
  console.log("Indexes are ready.");
  await db.end();
}
main().catch(async (error) => { console.error(error); await db.end(); process.exit(1); });
