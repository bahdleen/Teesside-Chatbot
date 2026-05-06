#!/usr/bin/env bash
set -euo pipefail
sudo apt update
sudo apt install -y php php-pgsql php-cli wget
mkdir -p "$HOME/adminer"
cd "$HOME/adminer"
wget https://www.adminer.org/latest.php -O adminer.php
echo "Start Adminer with: php -S 0.0.0.0:8080 -t $HOME/adminer"
echo "Open: http://SERVER_IP:8080/adminer.php"
echo "Login: System PostgreSQL, Server localhost, User campuspaddy, Password campuspaddy, DB campuspaddy_local"
