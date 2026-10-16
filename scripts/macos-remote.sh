#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared was not found."
  echo "Install it on the Mac with one of these options:"
  echo "  brew install cloudflared"
  echo "  or download it from https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
  exit 1
fi

if ! curl -fsS http://127.0.0.1:3000 >/dev/null 2>&1; then
  launchctl start com.mail-reply-studio.app >/dev/null 2>&1 || true
  sleep 3
fi

if ! curl -fsS http://127.0.0.1:3000 >/dev/null 2>&1; then
  echo "The app is not reachable at http://127.0.0.1:3000."
  echo "Run: bash scripts/macos-setup.sh"
  exit 1
fi

echo "Remote tunnel is starting. Wait for an https://*.trycloudflare.com URL below."
echo "Keep this Terminal window open while using the temporary remote URL."
cloudflared tunnel --url http://127.0.0.1:3000
