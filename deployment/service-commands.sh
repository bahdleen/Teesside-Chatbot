#!/usr/bin/env bash
set -euo pipefail
sudo cp deployment/campuspaddy-ai-api.service /etc/systemd/system/campuspaddy-ai-api.service
sudo systemctl daemon-reload
sudo systemctl enable campuspaddy-ai-api
sudo systemctl start campuspaddy-ai-api
sudo systemctl status campuspaddy-ai-api --no-pager
systemctl is-enabled campuspaddy-ai-api
systemctl is-enabled cloudflared
systemctl is-enabled ollama
