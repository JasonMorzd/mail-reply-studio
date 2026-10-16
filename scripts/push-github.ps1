$ErrorActionPreference = "Stop"

$owner = "JasonMorzd"
$repo = "mail-reply-studio"
$branch = "main"
$api = "https://api.github.com"

function Invoke-GitHubApi {
  param(
    [string]$Method,
    [string]$Uri,
    [object]$Body
  )

  $params = @{
    Method = $Method
    Uri = $Uri
    Headers = $headers
  }
  if ($null -ne $Body) {
    $params.ContentType = "application/json"
    $params.Body = ($Body | ConvertTo-Json -Depth 20 -Compress)
  }
  Invoke-RestMethod @params
}

$null = Read-Host "Copy the new GitHub token, then press Enter"
$token = Get-Clipboard -Raw
$token = [regex]::Replace($token, "[^\x21-\x7E]", "")
if ([string]::IsNullOrWhiteSpace($token)) {
  throw "Token cannot be empty."
}

$headers = @{
  Authorization = "Bearer $token"
  Accept = "application/vnd.github+json"
  "X-GitHub-Api-Version" = "2022-11-28"
  "User-Agent" = "mail-reply-studio-publisher"
}

$root = (Get-Location).Path
$excluded = @(".git", ".next", "node_modules", ".mail-reply-data", ".env", ".env.local", "logs", "backups", "work", "outputs", "tools")
$files = Get-ChildItem -Path $root -Recurse -File | Where-Object {
  $relative = $_.FullName.Substring($root.Length + 1)
  $parts = $relative -split "[\\/]"
  -not ($parts | Where-Object { $excluded -contains $_ })
}

$ref = Invoke-GitHubApi "GET" "$api/repos/$owner/$repo/git/ref/heads/$branch" $null
$parentSha = $ref.object.sha
$parentCommit = Invoke-GitHubApi "GET" "$api/repos/$owner/$repo/git/commits/$parentSha" $null
$entries = @()

foreach ($file in $files) {
  $relative = $file.FullName.Substring($root.Length + 1).Replace("\", "/")
  Write-Host "Uploading $relative"
  $content = [Convert]::ToBase64String([IO.File]::ReadAllBytes($file.FullName))
  $blob = Invoke-GitHubApi "POST" "$api/repos/$owner/$repo/git/blobs" @{
    content = $content
    encoding = "base64"
  }
  $mode = if ($file.Extension -in @(".sh", ".ps1", ".cmd")) { "100755" } else { "100644" }
  $entries += @{
    path = $relative
    mode = $mode
    type = "blob"
    sha = $blob.sha
  }
}

$tree = Invoke-GitHubApi "POST" "$api/repos/$owner/$repo/git/trees" @{
  base_tree = $parentCommit.tree.sha
  tree = $entries
}

$commit = Invoke-GitHubApi "POST" "$api/repos/$owner/$repo/git/commits" @{
  message = "Collapse knowledge entries and share style sources"
  tree = $tree.sha
  parents = @($parentSha)
}

Invoke-GitHubApi "PATCH" "$api/repos/$owner/$repo/git/refs/heads/$branch" @{
  sha = $commit.sha
  force = $false
} | Out-Null

Write-Host ""
Write-Host "Pushed to https://github.com/$owner/$repo/tree/$branch"
