CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pgvector extension not available. Embeddings can be added later.';
END $$;

CREATE TABLE IF NOT EXISTS universities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  domain TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crawl_urls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID REFERENCES universities(id) ON DELETE CASCADE,
  url TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'pending',
  content_type TEXT,
  discovered_from TEXT,
  depth INT DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMP DEFAULT now(),
  scraped_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS knowledge_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID REFERENCES universities(id) ON DELETE CASCADE,
  url TEXT NOT NULL UNIQUE,
  title TEXT,
  source_type TEXT NOT NULL,
  raw_file_path TEXT,
  extracted_text TEXT,
  content_hash TEXT,
  status TEXT DEFAULT 'pending',
  processing_error TEXT,
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES knowledge_sources(id) ON DELETE CASCADE,
  university_id UUID REFERENCES universities(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  chunk_text TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crawl_urls_status_depth_idx ON crawl_urls(status, depth);
CREATE INDEX IF NOT EXISTS knowledge_sources_status_idx ON knowledge_sources(status);
CREATE INDEX IF NOT EXISTS knowledge_sources_type_idx ON knowledge_sources(source_type);
CREATE INDEX IF NOT EXISTS knowledge_chunks_source_idx ON knowledge_chunks(source_id);
CREATE INDEX IF NOT EXISTS knowledge_chunks_university_idx ON knowledge_chunks(university_id);
