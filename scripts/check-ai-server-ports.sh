#!/usr/bin/env bash
set -euo pipefail
sudo ss -tulpn | grep LISTEN | sort -k5
ps aux | grep -E "node|npm|pm2|ollama|cloudflared" | grep -v grep || true
