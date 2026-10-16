param(
  [Parameter(Mandatory = $true)]
  [string]$MacHost,
  [string]$MacUser = "",
  [string]$RemotePath = "~/mail-reply-studio"
)

$ErrorActionPreference = "Stop"
$ssh = Get-Command ssh -ErrorAction SilentlyContinue
if (-not $ssh) {
  throw "OpenSSH was not found on this computer. Install Windows OpenSSH first."
}

$target = if ([string]::IsNullOrWhiteSpace($MacUser)) {
  $MacHost
} else {
  "$MacUser@$MacHost"
}

Write-Host "Connecting to $target ..."
& $ssh.Source $target "cd $RemotePath && bash scripts/macos-update.sh"
if ($LASTEXITCODE -ne 0) {
  throw "Mac update failed."
}

Write-Host "Mac update completed."
