#!/usr/bin/env bash
set -euo pipefail

PLIST="$HOME/Library/LaunchAgents/com.mail-reply-studio.app.plist"
launchctl stop com.mail-reply-studio.app >/dev/null 2>&1 || true
launchctl unload "$PLIST" >/dev/null 2>&1 || true
echo "Mail Reply Studio has been stopped."
