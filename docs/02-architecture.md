# Architecture

```text
Teesside website
  ↓
Scraper/importer server
  - crawlTeesside.ts
  - raw HTML/PDF/DOCX files
  - processAllSources.ts
  - chunks in local PostgreSQL
  ↓
pg_dump / pg_restore
  ↓
Neon PostgreSQL
  - universities
  - crawl_urls
  - knowledge_sources
  - knowledge_chunks
  - chatbot_cached_answers
  - optimized tsvector columns
  ↓
AI server
  - Express API on 127.0.0.1:3011
  - cache check
  - optimized Neon retrieval
  - Ollama llama3.1:8b on 127.0.0.1:11434
  ↓
Cloudflare Tunnel
  ↓
Public app API
```

The AI does not read raw files directly. It reads relevant chunks returned from Neon retrieval.
