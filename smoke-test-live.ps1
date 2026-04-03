$key = 'Bearer sk_live_9510c86adcac144ff1e1b41fd60b985da62ed8ccf4deac93'
$base = 'https://api.ebenova.dev'

Write-Host "`n=== 1. MCP tools/list ===" -ForegroundColor Cyan
$body = '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
$r = Invoke-RestMethod -Uri "$base/mcp" -Method Post -Body $body -ContentType 'application/json' -Headers @{Authorization=$key}
$tools = $r.result.tools
Write-Host "Tools registered: $($tools.Count)"
$tools | ForEach-Object { Write-Host "  - $($_.name)" }

Write-Host "`n=== 2. /v1/documents/types ===" -ForegroundColor Cyan
$r2 = Invoke-RestMethod -Uri "$base/v1/documents/types" -Headers @{Authorization=$key}
Write-Host "Success: $($r2.success) | Total types: $($r2.total)"

Write-Host "`n=== 3. /v1/vigil/authorize (expects 503 - Vigil not deployed yet) ===" -ForegroundColor Cyan
try {
  $body3 = '{"card_id":"card_01","merchant_name":"Test","merchant_country":"CA","amount_cents":100,"currency":"cad"}'
  $r3 = Invoke-RestMethod -Uri "$base/v1/vigil/authorize" -Method Post -Body $body3 -ContentType 'application/json' -Headers @{Authorization=$key}
  Write-Host "Response: $($r3 | ConvertTo-Json -Depth 2)"
} catch {
  $status = $_.Exception.Response.StatusCode.value__
  Write-Host "HTTP $status (expected 503 until Vigil is deployed)"
}

Write-Host "`n=== 4. /v1/billing/checkout (Insights tier) ===" -ForegroundColor Cyan
try {
  $body4 = '{"tier":"insights_starter","email":"test@example.com"}'
  $r4 = Invoke-RestMethod -Uri "$base/v1/billing/checkout" -Method Post -Body $body4 -ContentType 'application/json' -Headers @{Authorization=$key}
  Write-Host "Checkout URL generated: $($r4.success) | Tier: $($r4.tier)"
  Write-Host "URL prefix: $($r4.checkout_url.Substring(0,[Math]::Min(60,$r4.checkout_url.Length)))..."
} catch {
  Write-Host "Error: $_"
}

Write-Host "`n=== All checks complete ===" -ForegroundColor Green
