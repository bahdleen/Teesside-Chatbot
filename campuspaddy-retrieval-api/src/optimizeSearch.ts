import "dotenv/config";
import { db } from "./db";

async function main() {
  console.log("Adding stored search vector columns...");
  await db.query(`ALTER TABLE public.knowledge_chunks ADD COLUMN IF NOT EXISTS chunk_search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english', COALESCE(chunk_text, ''))) STORED;`);
  await db.query(`ALTER TABLE public.knowledge_sources ADD COLUMN IF NOT EXISTS source_search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(url, '') || ' ' || COALESCE(source_type, ''))) STORED;`);
  console.log("Creating optimized indexes...");
  await db.query(`CREATE INDEX IF NOT EXISTS knowledge_chunks_search_vector_idx ON public.knowledge_chunks USING GIN (chunk_search_vector);`);
  await db.query(`CREATE INDEX IF NOT EXISTS knowledge_sources_search_vector_idx ON public.knowledge_sources USING GIN (source_search_vector);`);
  await db.query(`CREATE INDEX IF NOT EXISTS knowledge_sources_processed_idx ON public.knowledge_sources (id) WHERE status = 'processed';`);
  await db.query(`CREATE INDEX IF NOT EXISTS universities_domain_id_idx ON public.universities (domain, id);`);
  await db.query(`CREATE INDEX IF NOT EXISTS knowledge_chunks_university_source_idx ON public.knowledge_chunks (university_id, source_id);`);
  console.log("Running analyze...");
  await db.query(`ANALYZE public.knowledge_chunks;`);
  await db.query(`ANALYZE public.knowledge_sources;`);
  await db.query(`ANALYZE public.universities;`);
  console.log("Search optimization complete.");
  await db.end();
}
main().catch(async (error) => { console.error(error); await db.end(); process.exit(1); });
