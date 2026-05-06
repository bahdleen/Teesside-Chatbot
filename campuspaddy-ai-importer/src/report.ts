import "dotenv/config";
import { db } from "./db";

async function main() {
  const queries = [
    ["crawl_urls by status", `SELECT status, COUNT(*)::int AS count FROM crawl_urls GROUP BY status ORDER BY status`],
    ["knowledge_sources by status", `SELECT status, COUNT(*)::int AS count FROM knowledge_sources GROUP BY status ORDER BY status`],
    ["knowledge_sources by type", `SELECT source_type, COUNT(*)::int AS count FROM knowledge_sources GROUP BY source_type ORDER BY source_type`],
    ["total chunks", `SELECT COUNT(*)::int AS total_chunks FROM knowledge_chunks`],
    ["recent sources", `SELECT title, source_type, status, url FROM knowledge_sources ORDER BY created_at DESC LIMIT 20`],
    ["pdf status", `SELECT status, COUNT(*)::int AS count FROM knowledge_sources WHERE source_type='pdf' GROUP BY status ORDER BY status`],
  ] as const;

  for (const [title, sql] of queries) {
    console.log(`\n=== ${title} ===`);
    const result = await db.query(sql);
    console.table(result.rows);
  }
  await db.end();
}

main().catch(async (error) => {
  console.error(error);
  await db.end();
  process.exit(1);
});
