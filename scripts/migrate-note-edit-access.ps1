[CmdletBinding()]
param(
  [string]$CloudflareApiToken = $env:CLOUDFLARE_API_TOKEN,
  [string]$CloudflareAccountId = $env:CLOUDFLARE_ACCOUNT_ID,
  [string]$NamespaceId = "",
  [string]$WranglerConfig = "wrangler.toml",
  [string]$Prefix = "note:",
  [int]$AccessTokenLength = 24,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Resolve-NotesKvNamespaceId {
  param(
    [Parameter(Mandatory = $true)]
    [string]$WranglerTomlPath
  )

  if (-not (Test-Path -LiteralPath $WranglerTomlPath -PathType Leaf)) {
    throw "Wrangler config not found: $WranglerTomlPath"
  }

  $content = Get-Content -LiteralPath $WranglerTomlPath -Raw
  $match = [regex]::Match(
    $content,
    '(?ms)\[\[kv_namespaces\]\]\s*.*?binding\s*=\s*"NOTES_KV"\s*.*?id\s*=\s*"([^"]+)"'
  )

  if (-not $match.Success) {
    throw "Could not find NOTES_KV id in wrangler config: $WranglerTomlPath"
  }

  return $match.Groups[1].Value.Trim()
}

function New-AccessToken {
  param(
    [Parameter(Mandatory = $true)]
    [int]$Length
  )

  if ($Length -lt 3) {
    throw "Length must be >= 3"
  }

  $upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
  $lower = "abcdefghijklmnopqrstuvwxyz"
  $digits = "0123456789"
  $alphabet = "$upper$lower$digits"
  $requiredGroups = @($upper, $lower, $digits)

  $chars = New-Object char[] $Length
  for ($i = 0; $i -lt $Length; $i++) {
    $index = [System.Security.Cryptography.RandomNumberGenerator]::GetInt32($alphabet.Length)
    $chars[$i] = $alphabet[$index]
  }

  $usedIndices = New-Object "System.Collections.Generic.HashSet[int]"
  foreach ($group in $requiredGroups) {
    do {
      $position = [System.Security.Cryptography.RandomNumberGenerator]::GetInt32($Length)
    } while ($usedIndices.Contains($position))

    $usedIndices.Add($position) | Out-Null
    $charIndex = [System.Security.Cryptography.RandomNumberGenerator]::GetInt32($group.Length)
    $chars[$position] = $group[$charIndex]
  }

  return -join $chars
}

function Test-ValidAccessToken {
  param(
    [AllowNull()]
    [string]$Token
  )

  if ([string]::IsNullOrWhiteSpace($Token)) {
    return $false
  }

  return $Token -match '^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])[A-Za-z0-9]{16,128}$'
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$wranglerConfigPath = if ([System.IO.Path]::IsPathRooted($WranglerConfig)) {
  $WranglerConfig
} else {
  Join-Path $repoRoot $WranglerConfig
}

if ([string]::IsNullOrWhiteSpace($CloudflareApiToken)) {
  throw "Cloudflare API token is required. Use -CloudflareApiToken or set CLOUDFLARE_API_TOKEN."
}

if ([string]::IsNullOrWhiteSpace($CloudflareAccountId)) {
  throw "Cloudflare account id is required. Use -CloudflareAccountId or set CLOUDFLARE_ACCOUNT_ID."
}

if ([string]::IsNullOrWhiteSpace($NamespaceId)) {
  $NamespaceId = Resolve-NotesKvNamespaceId -WranglerTomlPath $wranglerConfigPath
}

if ($AccessTokenLength -lt 16) {
  throw "AccessTokenLength must be >= 16."
}

$headers = @{
  Authorization = "Bearer $CloudflareApiToken"
}

$baseUrl = "https://api.cloudflare.com/client/v4/accounts/$CloudflareAccountId/storage/kv/namespaces/$NamespaceId"

Write-Host "Wrangler config: $wranglerConfigPath"
Write-Host "Namespace id: $NamespaceId"
Write-Host "Key prefix: $Prefix"
Write-Host "Access token length: $AccessTokenLength"
Write-Host "Dry run: $($DryRun.IsPresent)"

$processed = 0
$migrated = 0
$alreadyValid = 0
$failed = 0
$cursor = $null
$page = 0

do {
  $page += 1
  $listUrl = "$baseUrl/keys?prefix=$([System.Uri]::EscapeDataString($Prefix))"
  if (-not [string]::IsNullOrWhiteSpace($cursor)) {
    $listUrl += "&cursor=$([System.Uri]::EscapeDataString($cursor))"
  }

  $listResponse = Invoke-RestMethod -Method Get -Uri $listUrl -Headers $headers
  if (-not $listResponse.success) {
    throw "Cloudflare API failed to list keys for page $page."
  }

  $keys = @($listResponse.result)
  Write-Host "Page ${page}: $($keys.Count) keys."

  foreach ($entry in $keys) {
    $keyName = [string]$entry.name
    $processed += 1

    try {
      $valueUrl = "$baseUrl/values/$([System.Uri]::EscapeDataString($keyName))"
      $rawContent = (Invoke-WebRequest -Method Get -Uri $valueUrl -Headers $headers).Content
      $rawValue = if ($rawContent -is [byte[]]) {
        [System.Text.Encoding]::UTF8.GetString($rawContent)
      } else {
        [string]$rawContent
      }
      $note = $rawValue | ConvertFrom-Json -AsHashtable

      if ($note -isnot [System.Collections.IDictionary]) {
        throw "Value is not a JSON object."
      }

      $existingToken = $null
      if ($note.Contains("editAccessToken")) {
        $existingToken = [string]$note["editAccessToken"]
      }

      if (Test-ValidAccessToken -Token $existingToken) {
        $alreadyValid += 1
        continue
      }

      $note["editAccessToken"] = New-AccessToken -Length $AccessTokenLength
      $updatedValue = $note | ConvertTo-Json -Depth 20 -Compress

      if (-not $DryRun.IsPresent) {
        $null = Invoke-RestMethod `
          -Method Put `
          -Uri $valueUrl `
          -Headers $headers `
          -Body $updatedValue `
          -ContentType "text/plain; charset=utf-8"
      }

      $migrated += 1
    } catch {
      $failed += 1
      Write-Warning "Failed key ${keyName}: $($_.Exception.Message)"
    }
  }

  $cursor = $null
  if ($listResponse.result_info -and $listResponse.result_info.cursor) {
    $cursor = [string]$listResponse.result_info.cursor
    if ([string]::IsNullOrWhiteSpace($cursor)) {
      $cursor = $null
    }
  }
} while ($cursor)

Write-Host ""
Write-Host "Migration summary:"
Write-Host "Processed keys: $processed"
Write-Host "Already valid: $alreadyValid"
Write-Host "Migrated: $migrated"
Write-Host "Failed: $failed"

if ($DryRun.IsPresent) {
  Write-Host "Dry run completed. No KV values were changed."
}

if ($failed -gt 0) {
  throw "Migration finished with failures."
}

Write-Host "Migration completed successfully."
