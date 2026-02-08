[CmdletBinding()]
param(
  [string]$EnvFile = ".dev.vars",
  [string]$WranglerConfig = "wrangler.toml",
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

$wranglerConfigPath = if ([System.IO.Path]::IsPathRooted($WranglerConfig)) {
  $WranglerConfig
} else {
  Join-Path $repoRoot $WranglerConfig
}

if (-not (Test-Path -LiteralPath $envPath -PathType Leaf)) {
  throw "Env file not found: $envPath"
}

if (-not (Test-Path -LiteralPath $wranglerConfigPath -PathType Leaf)) {
  throw "Wrangler config not found: $wranglerConfigPath"
}

$envMap = Read-DotEnv -Path $envPath

$secretKeys = @($envMap.Keys | Sort-Object)
if ($secretKeys.Count -eq 0) {
  throw "No variables found in ${envPath}."
}

$emptyValueKeys = $secretKeys | Where-Object { [string]::IsNullOrWhiteSpace($envMap[$_]) }
if ($emptyValueKeys.Count -gt 0) {
  throw "Variables with empty values in ${envPath}: $($emptyValueKeys -join ', ')"
}

Write-Host "Env file: $envPath"
Write-Host "Wrangler config: $wranglerConfigPath"
Write-Host "Secrets to set: $($secretKeys -join ', ')"

if ($DryRun) {
  Write-Host "Dry run mode enabled. Secrets were not uploaded."
  exit 0
}

Push-Location $repoRoot
try {
  foreach ($key in $secretKeys) {
    $value = $envMap[$key]
    Write-Host "Setting Worker secret: $key"

    $value | & npx wrangler secret put $key --config $wranglerConfigPath
    if ($LASTEXITCODE -ne 0) {
      throw "Failed to set secret: $key"
    }
  }
}
finally {
  Pop-Location
}

Write-Host "All Worker secrets were set successfully."
