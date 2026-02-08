[CmdletBinding()]
param(
  [string]$EnvFile = ".dev.vars",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Read-DotEnv {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  $map = @{}

  foreach ($rawLine in Get-Content -LiteralPath $Path) {
    $line = $rawLine.Trim()
    if (-not $line -or $line.StartsWith("#")) {
      continue
    }

    $separatorIndex = $line.IndexOf("=")
    if ($separatorIndex -lt 1) {
      continue
    }

    $key = $line.Substring(0, $separatorIndex).Trim()
    $value = $line.Substring($separatorIndex + 1).Trim()

    if (
      (($value.StartsWith('"')) -and ($value.EndsWith('"'))) -or
      (($value.StartsWith("'")) -and ($value.EndsWith("'")))
    ) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    $map[$key] = $value
  }

  return $map
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$envPath = if ([System.IO.Path]::IsPathRooted($EnvFile)) {
  $EnvFile
} else {
  Join-Path $repoRoot $EnvFile
}

if (-not (Test-Path -LiteralPath $envPath -PathType Leaf)) {
  throw "Env file not found: $envPath"
}

$envMap = Read-DotEnv -Path $envPath

$requiredKeys = @(
  "TELEGRAM_BOT_TOKEN",
  "PUBLIC_DOMAIN"
)

$missing = $requiredKeys | Where-Object {
  (-not $envMap.ContainsKey($_)) -or [string]::IsNullOrWhiteSpace($envMap[$_])
}

if ($missing.Count -gt 0) {
  throw "Missing required keys in ${envPath}: $($missing -join ', ')"
}

$botToken = $envMap["TELEGRAM_BOT_TOKEN"].Trim()
$publicDomain = $envMap["PUBLIC_DOMAIN"].Trim().TrimEnd("/")

if ($publicDomain -notmatch "^https?://") {
  throw "PUBLIC_DOMAIN must start with http:// or https://. Current value: $publicDomain"
}

$expectedWebhookUrl = "$publicDomain/telegram/webhook"
$webhookInfoUrl = "https://api.telegram.org/bot$botToken/getWebhookInfo"
$healthUrl = "$publicDomain/health"

Write-Host "Env file: $envPath"
Write-Host "Expected webhook URL: $expectedWebhookUrl"
Write-Host "Worker health URL: $healthUrl"

if ($DryRun) {
  Write-Host "Dry run mode enabled. Requests were not sent."
  exit 0
}

$webhookInfo = Invoke-RestMethod -Method Get -Uri $webhookInfoUrl
if (-not $webhookInfo.ok) {
  $description = if ($webhookInfo.description) { $webhookInfo.description } else { "Unknown Telegram API error." }
  throw "Telegram API returned ok=false for getWebhookInfo: $description"
}

$actualWebhookUrl = $webhookInfo.result.url
$pendingUpdates = $webhookInfo.result.pending_update_count

Write-Host "Telegram webhook URL: $actualWebhookUrl"
Write-Host "Pending updates: $pendingUpdates"

if ($actualWebhookUrl -ne $expectedWebhookUrl) {
  throw "Webhook URL mismatch. Expected: $expectedWebhookUrl ; Actual: $actualWebhookUrl"
}

$healthResponse = Invoke-RestMethod -Method Get -Uri $healthUrl
if (-not $healthResponse.ok) {
  throw "Worker /health returned ok=false."
}

Write-Host "Worker health status: ok"
if ($healthResponse.now) {
  Write-Host "Worker time: $($healthResponse.now)"
}

Write-Host "Webhook and Worker health checks passed."
