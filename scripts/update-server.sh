#!/usr/bin/env bash
set -euo pipefail

if [ ! -f docker-compose.server.yml ] && [ ! -f docker-compose.prod.yml ]; then
  echo "Run this script from the project directory."
  exit 1
fi

compose_file="docker-compose.server.yml"
if [ ! -f "$compose_file" ]; then
  compose_file="docker-compose.prod.yml"
fi

bash scripts/backup-data.sh
git pull --ff-only
docker compose -f "$compose_file" up -d --build
docker compose -f "$compose_file" ps
