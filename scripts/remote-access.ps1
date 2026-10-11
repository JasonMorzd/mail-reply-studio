param(
  [int]$Port = 3001
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

if (-not $env:APP_ACCESS_PASSWORD) {
  $password = Read-Host "Set a remote access password (it will not be saved in project files)"
  if ([string]::IsNullOrWhiteSpace($password)) {
    throw "A remote access password is required."
  }
  $env:APP_ACCESS_PASSWORD = $password
}

$cloudflared = Get-Command cloudflared -ErrorAction SilentlyContinue
if (-not $cloudflared) {
  $localBinary = Join-Path $projectRoot "tools\cloudflared.exe"
  if (Test-Path $localBinary) {
    $cloudflaredPath = $localBinary
  } else {
    Write-Host ""
    Write-Host "cloudflared was not found." -ForegroundColor Yellow
    Write-Host "Install the Windows version from the Cloudflare page, or put cloudflared.exe in tools\cloudflared.exe:"
    Write-Host "https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
    Write-Host ""
    Write-Host "Then run: pnpm remote"
    exit 1
  }
} else {
  $cloudflaredPath = $cloudflared.Source
}

try {
  Invoke-WebRequest -Uri "http://127.0.0.1:$Port" -UseBasicParsing -TimeoutSec 2 | Out-Null
  throw "Port $Port is already in use. Stop that process or run this script with -Port another-port."
} catch [System.Net.WebException] {
  Write-Host "Starting a password-protected remote instance at http://127.0.0.1:$Port ..." -ForegroundColor Cyan
  $pnpm = (Get-Command pnpm -ErrorAction Stop).Source
  Start-Process -FilePath $pnpm -ArgumentList "dev", "--", "-p", "$Port" -WorkingDirectory $projectRoot -WindowStyle Minimized
  $ready = $false
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    Start-Sleep -Seconds 1
    try {
      Invoke-WebRequest -Uri "http://127.0.0.1:$Port" -UseBasicParsing -TimeoutSec 2 | Out-Null
      $ready = $true
      break
    } catch {}
  }
  if (-not $ready) {
    throw "The remote instance did not start in time. Run pnpm dev manually and check the output."
  }
}

Write-Host ""
Write-Host "Remote access is starting. Wait for an https://*.trycloudflare.com URL below." -ForegroundColor Green
Write-Host "The phone does not need local Wi-Fi, but this computer must stay on and online." -ForegroundColor DarkGray
Write-Host "Press Ctrl+C to stop remote access." -ForegroundColor DarkGray
Write-Host ""

& $cloudflaredPath tunnel --no-autoupdate --url "http://127.0.0.1:$Port"
