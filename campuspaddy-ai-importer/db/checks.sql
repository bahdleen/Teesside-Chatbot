SELECT status, COUNT(*) FROM crawl_urls GROUP BY status ORDER BY status;
SELECT status, COUNT(*) FROM knowledge_sources GROUP BY status ORDER BY status;
SELECT source_type, COUNT(*) FROM knowledge_sources GROUP BY source_type ORDER BY source_type;
SELECT COUNT(*) AS total_chunks FROM knowledge_chunks;
SELECT title, source_type, url FROM knowledge_sources ORDER BY created_at DESC LIMIT 50;
SELECT ks.title, ks.url, LEFT(kc.chunk_text, 1000) AS sample_chunk
FROM knowledge_chunks kc JOIN knowledge_sources ks ON ks.id = kc.source_id
LIMIT 10;
