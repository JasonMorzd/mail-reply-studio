#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v node >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1; then
    brew install node
  else
    echo "Node.js was not found. Install Node.js 22 LTS or Homebrew first, then run this script again."
    exit 1
  fi
fi

corepack enable >/dev/null 2>&1 || true
if ! command -v pnpm >/dev/null 2>&1; then
  corepack prepare pnpm@latest --activate
fi

PNPM="$(command -v pnpm)"
ENV_FILE="$ROOT/.env.local"
if [ ! -f "$ENV_FILE" ]; then
  cp "$ROOT/.env.example" "$ENV_FILE"
fi

if ! grep -q '^APP_ACCESS_PASSWORD=' "$ENV_FILE" || grep -q 'replace-with-a-long-private-password' "$ENV_FILE"; then
  printf "Set an app access password: "
  stty -echo
  read -r PASSWORD
  stty echo
  printf "\n"
  if [ -z "$PASSWORD" ]; then
    echo "Password is required."
    exit 1
  fi
  TMP_FILE="$(mktemp)"
  awk -v password="$PASSWORD" '
    BEGIN { replaced = 0 }
    /^APP_ACCESS_PASSWORD=/ {
      print "APP_ACCESS_PASSWORD=" password
      replaced = 1
      next
    }
    { print }
    END {
      if (!replaced) print "APP_ACCESS_PASSWORD=" password
    }
  ' "$ENV_FILE" > "$TMP_FILE"
  mv "$TMP_FILE" "$ENV_FILE"
fi

pnpm install
pnpm build
mkdir -p "$ROOT/logs"

PLIST="$HOME/Library/LaunchAgents/com.mail-reply-studio.app.plist"
COMMAND="cd \"$ROOT\" && \"$PNPM\" start >> \"$ROOT/logs/app.log\" 2>&1"
COMMAND_ESCAPED="$(printf '%s' "$COMMAND" | sed 's/&/\&amp;/g; s/</\&lt;/g; s/>/\&gt;/g')"

mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.mail-reply-studio.app</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>-lc</string>
    <string>$COMMAND_ESCAPED</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>WorkingDirectory</key>
  <string>$ROOT</string>
  <key>StandardOutPath</key>
  <string>$ROOT/logs/launchd.out.log</string>
  <key>StandardErrorPath</key>
  <string>$ROOT/logs/launchd.err.log</string>
</dict>
</plist>
EOF

launchctl unload "$PLIST" >/dev/null 2>&1 || true
launchctl load "$PLIST"
launchctl start com.mail-reply-studio.app >/dev/null 2>&1 || true

echo "Mac setup is done."
echo "Local URL: http://127.0.0.1:3000"
echo "Logs: $ROOT/logs/app.log"
echo "LaunchAgent: $PLIST"
