# Academic Submission Guide

This submission contains the implementation, technical report, and supporting evidence for the CampusPaddy AI chatbot knowledge pipeline.

## Primary Materials

- `docs/reports/TECHNICAL_IMPLEMENTATION.pdf` - main technical report for assessment.
- `docs/reports/TECHNICAL_IMPLEMENTATION.tex` - LaTeX source for the main report.
- `docs/reports/TECHNICAL_IMPLEMENTATION_SIMPLE.pdf` - concise supporting version.

## Implementation

- `campuspaddy-ai-importer/` - crawler, extraction, chunking, database schema, and migration tools.
- `campuspaddy-retrieval-api/` - retrieval API, search optimization, cache handling, and Ollama integration.
- `deployment/` - production service and Cloudflare Tunnel configuration templates.
- `docs/` - architecture, API, performance, security, and observed-results notes.

## Reproducibility Notes

Environment secrets are intentionally excluded. The `.env.example` files document the variables required to run each service. Generated LaTeX auxiliary files, local logs, package installs, and raw scraped storage are not part of the submission package.

To rebuild the main report locally:

```bash
cd docs/reports
pdflatex TECHNICAL_IMPLEMENTATION.tex
pdflatex TECHNICAL_IMPLEMENTATION.tex
```

The local TeX installation must include the standard Computer Modern and TS1 font metric packages.
