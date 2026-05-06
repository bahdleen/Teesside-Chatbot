# CampusPaddy AI Chatbot Knowledge Pipeline

CampusPaddy AI is a Teesside University knowledge pipeline and retrieval API. It crawls approved university web content, extracts and chunks source material, indexes it in PostgreSQL/Neon, and serves grounded answers through an Express API backed by local Ollama inference.

This package is structured for academic assessment. It includes the implementation, technical report, and reproducibility notes used to document the build and testing process.

## System Scope

The submission package contains the complete implementation for:

1. Teesside-only crawling for HTML, PDF, DOC, and DOCX sources.
2. Text extraction, chunking, and source tracking.
3. Local PostgreSQL inspection and migration to Neon.
4. Optimized PostgreSQL full-text retrieval with caching.
5. Ollama-backed answer generation.
6. Public API deployment through systemd and Cloudflare Tunnel.

Secrets are intentionally excluded. Use the `.env.example` files and provide your own `DATABASE_URL`, `NEON_DATABASE_URL`, `API_KEY`, and Cloudflare credentials.

## Repository Layout

```text
campuspaddy-ai-importer/       # crawler, processor, database schema, and migration tools
campuspaddy-retrieval-api/     # Express retrieval API, search optimization, and Ollama integration
deployment/                    # systemd and Cloudflare deployment templates
docs/                          # academic submission guide, architecture, API, security, performance, and results notes
docs/reports/                  # LaTeX technical reports and generated PDFs
scripts/                       # top-level validation and setup helper scripts
```

## Documentation

- [Academic Submission Guide](docs/00-academic-submission.md)
- [Architecture](docs/02-architecture.md)
- [API Reference](docs/03-api-reference.md)
- [Security Notes](docs/05-security.md)
- [Technical Implementation Report](docs/reports/TECHNICAL_IMPLEMENTATION.pdf)

## Tested Public Endpoint

```text
https://campuspaddy-ai.edjenuwahome.uk/ask
```
