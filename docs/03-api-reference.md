# API reference

Base URL:

```text
https://campuspaddy-ai.edjenuwahome.uk
```

## GET /health

Checks database, cache, model settings, and optimized search flags.

## GET /ollama/health

Checks Ollama and available models.

## GET /cache/stats

Shows cached answers and hits. Requires `x-api-key` if API_KEY is configured.

## POST /retrieve

Retrieves relevant chunks without asking Ollama.

Request:

```json
{
  "question": "How do I contact accommodation?",
  "limit": 3,
  "universityDomain": "tees.ac.uk"
}
```

## POST /ask

Main chatbot endpoint.

Request:

```json
{
  "question": "How do I contact accommodation?",
  "limit": 3,
  "useCache": true,
  "universityDomain": "tees.ac.uk"
}
```

Response includes:

```json
{
  "ok": true,
  "cached": true,
  "answer": "...",
  "sources": [],
  "duration_ms": 200
}
```

If API_KEY is set, call with:

```bash
curl -X POST https://campuspaddy-ai.edjenuwahome.uk/ask \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{"question":"How do I contact accommodation?"}'
```
