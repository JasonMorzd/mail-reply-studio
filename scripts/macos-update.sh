#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ ! -d .git ]; then
  echo "This Mac copy is not connected to a Git repository."
  echo "Set up the private repository once, then run this script again."
  exit 1
fi

mkdir -p backups
timestamp="$(date +%Y%m%d-%H%M%S)"
if [ -d .mail-reply-data ]; then
  tar -czf "backups/mail-reply-data-$timestamp.tar.gz" .mail-reply-data
fi

git pull --ff-only
pnpm install --frozen-lockfile
pnpm build

PLIST="$HOME/Library/LaunchAgents/com.mail-reply-studio.app.plist"
launchctl stop com.mail-reply-studio.app >/dev/null 2>&1 || true
launchctl start com.mail-reply-studio.app >/dev/null 2>&1 || true

echo "Mac update complete."
echo "Data backup: backups/mail-reply-data-$timestamp.tar.gz"
echo "App URL: http://127.0.0.1:3000"
