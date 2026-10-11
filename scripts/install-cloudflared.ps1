$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$tools = Join-Path $projectRoot "tools"
$target = Join-Path $tools "cloudflared.exe"

New-Item -ItemType Directory -Force -Path $tools | Out-Null
$url = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
Write-Host "Downloading cloudflared from the official Cloudflare release URL..."
Invoke-WebRequest -Uri $url -OutFile $target -UseBasicParsing
Write-Host "Installed: $target"
Write-Host "Now run: pnpm remote"
