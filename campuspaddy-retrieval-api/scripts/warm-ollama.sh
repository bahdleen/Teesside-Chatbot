#!/usr/bin/env bash
set -euo pipefail
MODEL="${OLLAMA_MODEL:-llama3.1:8b}"
curl http://127.0.0.1:11434/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"model\":\"$MODEL\",\"stream\":false,\"keep_alive\":\"24h\",\"messages\":[{\"role\":\"user\",\"content\":\"Reply with ready.\"}],\"options\":{\"num_predict\":10}}"
