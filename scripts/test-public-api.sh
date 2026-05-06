#!/usr/bin/env bash
set -euo pipefail
BASE_URL="${BASE_URL:-https://campuspaddy-ai.edjenuwahome.uk}"
API_KEY_HEADER=()
if [ -n "${API_KEY:-}" ]; then API_KEY_HEADER=(-H "x-api-key: $API_KEY"); fi
curl -s "$BASE_URL/health" | jq
curl -s -X POST "$BASE_URL/ask" -H "Content-Type: application/json" "${API_KEY_HEADER[@]}" -d '{"question":"How do I contact accommodation?"}' | jq
