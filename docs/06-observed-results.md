# Observed results from the build

## Scraping / processing

```text
knowledge_sources:
- processed: 11753
- failed: 306

total knowledge_chunks: 25345

source types:
- html: 11503
- pdf: 454
- docx: 80
- doc: 22
```

Old `.doc` files failed because the processor supports HTML, PDF, and DOCX, but not legacy binary DOC.

## Ollama / GPU

```text
GPU: Tesla P40
VRAM: 23040MiB
Driver: 535.288.01
CUDA: 12.2
Model used: llama3.1:8b
```

First Ollama warm request was slower due to model load. Second warm request was around 0.64s.

## API performance

Cached request example:

```text
How do I contact accommodation?
Duration: ~0.2s - 0.7s through public Cloudflare URL
```

Uncached optimized request example:

```text
Where can I get mental health support?
Total duration: ~5.3s
Retrieval duration: ~0.95s
Ollama duration: ~4.3s
```

## Public API

```text
https://campuspaddy-ai.edjenuwahome.uk/ask
```
