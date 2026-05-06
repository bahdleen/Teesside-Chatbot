import "dotenv/config";
import { db } from "./db";

async function main() {
  const result = await db.query(`SELECT current_database(), current_user, current_schema(), now()`);
  console.table(result.rows);
  const tables = await db.query(`SELECT schemaname, tablename FROM pg_tables WHERE tablename IN ('universities','crawl_urls','knowledge_sources','knowledge_chunks') ORDER BY schemaname, tablename`);
  console.table(tables.rows);
  await db.end();
}

main().catch(async (error) => {
  console.error(error);
  await db.end();
  process.exit(1);
});
