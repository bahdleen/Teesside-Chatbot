#!/usr/bin/env bash
set -euo pipefail
sudo apt update
sudo apt install -y curl wget git unzip build-essential ca-certificates gnupg lsb-release postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql
sudo -u postgres psql <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'campuspaddy') THEN
    CREATE USER campuspaddy WITH PASSWORD 'campuspaddy';
  END IF;
END $$;
SELECT 'CREATE DATABASE campuspaddy_local OWNER campuspaddy'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'campuspaddy_local')\gexec
GRANT ALL PRIVILEGES ON DATABASE campuspaddy_local TO campuspaddy;
SQL
psql postgresql://campuspaddy:campuspaddy@localhost:5432/campuspaddy_local -c 'SELECT current_database(), current_user;'
