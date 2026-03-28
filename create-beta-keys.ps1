# Ebenova API - Create 5 Beta Keys
# Run this script to create beta API keys for early users

$env:EBENOVA_ADMIN_SECRET="Ec2UbMeJpjLq3GzDfTBZ0C9WP6sSNgOHX7m45udoYiVFlQIx1tRvk8yaAhrKnw"

Write-Host "=== CREATING 5 BETA API KEYS ===" -ForegroundColor Green
Write-Host ""

# Beta 1: Klauza Founder
Write-Host "1. Klauza Founder (Growth Tier)..." -ForegroundColor Cyan
try {
  $r1 = Invoke-RestMethod -Uri 'https://api.ebenova.dev/v1/keys/create' -Method POST -Headers @{
    Authorization="Bearer $env:EBENOVA_ADMIN_SECRET"
    'Content-Type'='application/json'
  } -Body '{"owner":"klauza@founder.com","tier":"growth","label":"Beta - Klauza Founder"}'
  Write-Host "   ✓ Owner: $($r1.owner)" -ForegroundColor Green
  Write-Host "   ✓ Tier: $($r1.tier)" -ForegroundColor Green
  Write-Host "   ✓ Key: $($r1.api_key)" -ForegroundColor Yellow
  Write-Host "   ✓ Monthly Limit: $($r1.monthly_limit) documents" -ForegroundColor Green
} catch {
  Write-Host "   ✗ Error: $_" -ForegroundColor Red
}
Write-Host ""

# Beta 2: CrossMind (Ivan Lee)
Write-Host "2. CrossMind - Ivan Lee (Growth Tier)..." -ForegroundColor Cyan
try {
  $r2 = Invoke-RestMethod -Uri 'https://api.ebenova.dev/v1/keys/create' -Method POST -Headers @{
    Authorization="Bearer $env:EBENOVA_ADMIN_SECRET"
    'Content-Type'='application/json'
  } -Body '{"owner":"ivan@crossmind.ai","tier":"growth","label":"Beta - CrossMind"}'
  Write-Host "   ✓ Owner: $($r2.owner)" -ForegroundColor Green
  Write-Host "   ✓ Tier: $($r2.tier)" -ForegroundColor Green
  Write-Host "   ✓ Key: $($r2.api_key)" -ForegroundColor Yellow
  Write-Host "   ✓ Monthly Limit: $($r2.monthly_limit) documents" -ForegroundColor Green
} catch {
  Write-Host "   ✗ Error: $_" -ForegroundColor Red
}
Write-Host ""

# Beta 3: Some_Phrase_2373
Write-Host "3. Some_Phrase_2373 (Starter Tier)..." -ForegroundColor Cyan
try {
  $r3 = Invoke-RestMethod -Uri 'https://api.ebenova.dev/v1/keys/create' -Method POST -Headers @{
    Authorization="Bearer $env:EBENOVA_ADMIN_SECRET"
    'Content-Type'='application/json'
  } -Body '{"owner":"somephrase@founder.com","tier":"starter","label":"Beta - Some_Phrase"}'
  Write-Host "   ✓ Owner: $($r3.owner)" -ForegroundColor Green
  Write-Host "   ✓ Tier: $($r3.tier)" -ForegroundColor Green
  Write-Host "   ✓ Key: $($r3.api_key)" -ForegroundColor Yellow
  Write-Host "   ✓ Monthly Limit: $($r3.monthly_limit) documents" -ForegroundColor Green
} catch {
  Write-Host "   ✗ Error: $_" -ForegroundColor Red
}
Write-Host ""

# Beta 4: Wadim (DACH)
Write-Host "4. Wadim - DACH Distribution (Starter Tier)..." -ForegroundColor Cyan
try {
  $r4 = Invoke-RestMethod -Uri 'https://api.ebenova.dev/v1/keys/create' -Method POST -Headers @{
    Authorization="Bearer $env:EBENOVA_ADMIN_SECRET"
    'Content-Type'='application/json'
  } -Body '{"owner":"wadim@dach-founder.com","tier":"starter","label":"Beta - Wadim"}'
  Write-Host "   ✓ Owner: $($r4.owner)" -ForegroundColor Green
  Write-Host "   ✓ Tier: $($r4.tier)" -ForegroundColor Green
  Write-Host "   ✓ Key: $($r4.api_key)" -ForegroundColor Yellow
  Write-Host "   ✓ Monthly Limit: $($r4.monthly_limit) documents" -ForegroundColor Green
} catch {
  Write-Host "   ✗ Error: $_" -ForegroundColor Red
}
Write-Host ""

# Beta 5: Reserve
Write-Host "5. Reserve Key (Starter Tier)..." -ForegroundColor Cyan
try {
  $r5 = Invoke-RestMethod -Uri 'https://api.ebenova.dev/v1/keys/create' -Method POST -Headers @{
    Authorization="Bearer $env:EBENOVA_ADMIN_SECRET"
    'Content-Type'='application/json'
  } -Body '{"owner":"beta5@ebenova.dev","tier":"starter","label":"Beta - Reserve"}'
  Write-Host "   ✓ Owner: $($r5.owner)" -ForegroundColor Green
  Write-Host "   ✓ Tier: $($r5.tier)" -ForegroundColor Green
  Write-Host "   ✓ Key: $($r5.api_key)" -ForegroundColor Yellow
  Write-Host "   ✓ Monthly Limit: $($r5.monthly_limit) documents" -ForegroundColor Green
} catch {
  Write-Host "   ✗ Error: $_" -ForegroundColor Red
}
Write-Host ""

Write-Host "=== ALL 5 KEYS CREATED ===" -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  SECURITY WARNING:" -ForegroundColor Red
Write-Host "   - Save these keys securely" -ForegroundColor Yellow
Write-Host "   - DELETE this output after sending emails" -ForegroundColor Yellow
Write-Host "   - Never commit API keys to git" -ForegroundColor Yellow
Write-Host ""
