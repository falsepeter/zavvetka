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
  "TELEGRAM_WEBHOOK_SECRET",
  "PUBLIC_DOMAIN"
)

$missing = $requiredKeys | Where-Object {
  (-not $envMap.ContainsKey($_)) -or [string]::IsNullOrWhiteSpace($envMap[$_])
}

if ($missing.Count -gt 0) {
  throw "Missing required keys in ${envPath}: $($missing -join ', ')"
}

$botToken = $envMap["TELEGRAM_BOT_TOKEN"].Trim()
$webhookSecret = $envMap["TELEGRAM_WEBHOOK_SECRET"].Trim()
$publicDomain = $envMap["PUBLIC_DOMAIN"].Trim().TrimEnd("/")

if ($publicDomain -notmatch "^https?://") {
  throw "PUBLIC_DOMAIN must start with http:// or https://. Current value: $publicDomain"
}

$telegramApiUrl = "https://api.telegram.org/bot$botToken/setWebhook"
$webhookUrl = "$publicDomain/telegram/webhook"

Write-Host "Env file: $envPath"
Write-Host "Webhook URL: $webhookUrl"

if ($DryRun) {
  Write-Host "Dry run mode enabled. Request was not sent."
  exit 0
}

$response = Invoke-RestMethod `
  -Method Post `
  -Uri $telegramApiUrl `
  -Body @{
    url = $webhookUrl
    secret_token = $webhookSecret
  } `
  -ContentType "application/x-www-form-urlencoded"

if (-not $response.ok) {
  $description = if ($response.description) { $response.description } else { "Unknown Telegram API error." }
  throw "Telegram API returned ok=false: $description"
}

Write-Host "Webhook successfully set."
if ($response.description) {
  Write-Host "Telegram response: $($response.description)"
}
