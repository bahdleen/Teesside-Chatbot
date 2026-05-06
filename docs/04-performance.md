# Performance notes

Observed before optimization:

```text
Retrieval: 7-12s
Ollama: 4-5s
Total uncached: 13-16s
Cached: ~0.2s
```

After `npm run optimize:search`:

```text
Retrieval: ~0.95s
Ollama: ~4.3s
Total uncached: ~5.3s
Cached: ~0.2s
```

Settings used:

```env
DEFAULT_RETRIEVAL_LIMIT=3
MAX_RETRIEVAL_LIMIT=5
CHUNK_CONTEXT_CHARS=1000
OLLAMA_NUM_CTX=4096
OLLAMA_NUM_PREDICT=150
OLLAMA_MODEL=llama3.1:8b
```

The next improvement is streaming in the chatbot application layer.
