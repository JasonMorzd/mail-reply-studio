#!/usr/bin/env bash
set -euo pipefail

if [ ! -f docker-compose.prod.yml ]; then
  echo "Run this script from the project directory."
  exit 1
fi

bash scripts/backup-data.sh
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
