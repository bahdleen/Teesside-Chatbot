#!/usr/bin/env bash
set -euo pipefail
cd "$HOME/adminer"
php -S 0.0.0.0:8080
