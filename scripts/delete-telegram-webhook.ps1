[CmdletBinding()]
param(
  [string]$EnvFile = ".dev.vars",
  [switch]$DropPendingUpdates,
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

if (
  (-not $envMap.ContainsKey("TELEGRAM_BOT_TOKEN")) -or
  [string]::IsNullOrWhiteSpace($envMap["TELEGRAM_BOT_TOKEN"])
) {
  throw "Missing required key in ${envPath}: TELEGRAM_BOT_TOKEN"
}

$botToken = $envMap["TELEGRAM_BOT_TOKEN"].Trim()
$telegramApiUrl = "https://api.telegram.org/bot$botToken/deleteWebhook"

Write-Host "Env file: $envPath"
Write-Host "Drop pending updates: $($DropPendingUpdates.IsPresent)"

if ($DryRun) {
  Write-Host "Dry run mode enabled. Request was not sent."
  exit 0
}

$body = @{
  drop_pending_updates = $DropPendingUpdates.IsPresent
}

$response = Invoke-RestMethod `
  -Method Post `
  -Uri $telegramApiUrl `
  -Body ($body | ConvertTo-Json -Compress) `
  -ContentType "application/json; charset=utf-8"

if (-not $response.ok) {
  $description = if ($response.description) { $response.description } else { "Unknown Telegram API error." }
  throw "Telegram API returned ok=false for deleteWebhook: $description"
}

Write-Host "Webhook successfully deleted."
if ($response.description) {
  Write-Host "Telegram response: $($response.description)"
}
