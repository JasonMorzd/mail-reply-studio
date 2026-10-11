#!/usr/bin/env bash
set -euo pipefail

mkdir -p backups
timestamp="$(date +%Y%m%d-%H%M%S)"
target="backups/mail-reply-data-$timestamp.tar.gz"

docker compose -f docker-compose.prod.yml exec -T mail-reply-studio \
  tar -C /app -czf - .mail-reply-data > "$target"

echo "Backup written to $target"
