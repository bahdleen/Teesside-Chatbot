#!/usr/bin/env bash
set -euo pipefail
: "${LOCAL_DATABASE_URL:=postgresql://campuspaddy:campuspaddy@localhost:5432/campuspaddy_local}"
: "${NEON_DATABASE_URL:?Set NEON_DATABASE_URL first}"
DUMP_FILE="${DUMP_FILE:-campuspaddy_teesside.dump}"
pg_dump "$LOCAL_DATABASE_URL" --format=custom --no-owner --no-privileges --file="$DUMP_FILE"
ls -lh "$DUMP_FILE"
pg_restore --dbname="$NEON_DATABASE_URL" --no-owner --no-privileges --clean --if-exists --verbose "$DUMP_FILE"
psql "$NEON_DATABASE_URL" -c "SELECT status, COUNT(*) FROM public.knowledge_sources GROUP BY status ORDER BY status;"
psql "$NEON_DATABASE_URL" -c "SELECT COUNT(*) AS total_chunks FROM public.knowledge_chunks;"
