#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
mkdir -p "$ROOT/logs"
touch "$ROOT/logs/app.log"
tail -f "$ROOT/logs/app.log"
