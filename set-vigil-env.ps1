# set-vigil-env.ps1
# Sets VIGIL_API_URL in Vercel once Vigil is deployed on Railway/Render.
# Usage: edit $vigilUrl below, then run:  powershell -ExecutionPolicy Bypass -File set-vigil-env.ps1

param(
  [string]$VigilUrl = ""   # override from command line: -VigilUrl "https://your-vigil.up.railway.app"
)

$projectId = "prj_UX5S3MQIEpTyg9Qg3pyBZVRnWJyW"
$teamId    = "team_yCsDhwgKGCRS5YBx9K3bVHyK"

# ── Prompt for URL if not provided ───────────────────────────────────────────
if (-not $VigilUrl) {
  Write-Host "Enter your deployed Vigil URL (e.g. https://vigil-fraud-alert-mcp.up.railway.app):"
  $VigilUrl = Read-Host "Vigil URL"
}
$VigilUrl = $VigilUrl.TrimEnd("/")

# ── Find Vercel token ─────────────────────────────────────────────────────────
$tokenPaths = @(
  "$env:APPDATA\vercel\auth.json",
  "$env:APPDATA\Vercel\auth.json",
  "$env:LOCALAPPDATA\vercel\auth.json",
  "$env:USERPROFILE\.config\vercel\auth.json",
  "$env:USERPROFILE\.vercel\auth.json"
)
$token = $null
foreach ($p in $tokenPaths) {
  if (Test-Path $p) { $token = (Get-Content $p -Raw | ConvertFrom-Json).token; break }
}
if (-not $token) {
  $token = Read-Host "Paste your Vercel token (from vercel.com/account/tokens)"
}

$headers = @{ "Authorization" = "Bearer $token"; "Content-Type" = "application/json" }
$url     = "https://api.vercel.com/v10/projects/$projectId/env?teamId=$teamId"

$body = @{
  key    = "VIGIL_API_URL"
  value  = $VigilUrl
  type   = "plain"
  target = @("production", "preview", "development")
} | ConvertTo-Json -Compress

Write-Host "Setting VIGIL_API_URL = $VigilUrl"
try {
  Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $body | Out-Null
  Write-Host "OK" -ForegroundColor Green
} catch {
  # Try patch if already exists
  $listR    = Invoke-RestMethod -Uri $url -Method Get -Headers $headers
  $existing = $listR.envs | Where-Object { $_.key -eq "VIGIL_API_URL" } | Select-Object -First 1
  if ($existing) {
    $patchUrl  = "https://api.vercel.com/v10/projects/$projectId/env/$($existing.id)?teamId=$teamId"
    $patchBody = @{ value = $VigilUrl } | ConvertTo-Json -Compress
    Invoke-RestMethod -Uri $patchUrl -Method Patch -Headers $headers -Body $patchBody | Out-Null
    Write-Host "Patched OK" -ForegroundColor Green
  } else {
    Write-Host "FAILED: $($_.ErrorDetails.Message)" -ForegroundColor Red
  }
}

Write-Host ""
Write-Host "Done. Redeploy with: vercel --prod --yes" -ForegroundColor Cyan
