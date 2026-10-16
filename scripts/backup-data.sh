#!/usr/bin/env bash
set -euo pipefail

mkdir -p backups
timestamp="$(date +%Y%m%d-%H%M%S)"
target="backups/mail-reply-data-$timestamp.tar.gz"
compose_file="docker-compose.server.yml"

if [ ! -f "$compose_file" ]; then
  compose_file="docker-compose.prod.yml"
fi

docker compose -f "$compose_file" exec -T mail-reply-studio \
  tar -C /app -czf - .mail-reply-data > "$target"

echo "Backup written to $target"
