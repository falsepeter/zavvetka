param(
  [Parameter(Mandatory = $false)]
  [string]$CloudflareApiToken,

  [Parameter(Mandatory = $false)]
  [string]$CloudflareAccountId
)

$ErrorActionPreference = "Stop"

# Make sure Node tools are available even when PATH is not initialized in the shell.
if (Test-Path "C:\Program Files\nodejs") {
  $env:Path = "C:\Program Files\nodejs;$env:Path"
}

if (-not $CloudflareApiToken) {
  $CloudflareApiToken = $env:CLOUDFLARE_API_TOKEN
}

if (-not $CloudflareAccountId) {
  $CloudflareAccountId = $env:CLOUDFLARE_ACCOUNT_ID
}

if (-not $CloudflareApiToken) {
  throw "CLOUDFLARE_API_TOKEN не задан. Передай параметр -CloudflareApiToken или выстави env."
}

if (-not $CloudflareAccountId) {
  throw "CLOUDFLARE_ACCOUNT_ID не задан. Передай параметр -CloudflareAccountId или выстави env."
}

$env:CLOUDFLARE_API_TOKEN = $CloudflareApiToken
$env:CLOUDFLARE_ACCOUNT_ID = $CloudflareAccountId

Write-Host "Running: wrangler whoami"
& npx wrangler whoami

Write-Host "Running: wrangler deploy"
& npx wrangler deploy
