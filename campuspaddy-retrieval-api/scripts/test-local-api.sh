#!/usr/bin/env bash
set -euo pipefail
API_KEY_HEADER=()
if [ -n "${API_KEY:-}" ]; then API_KEY_HEADER=(-H "x-api-key: $API_KEY"); fi
curl -s http://127.0.0.1:3011/health | jq
time curl -s -X POST http://127.0.0.1:3011/ask -H "Content-Type: application/json" "${API_KEY_HEADER[@]}" -d '{"question":"How do I contact accommodation?"}' | jq
