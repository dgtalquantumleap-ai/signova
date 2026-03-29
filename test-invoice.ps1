$body = @{
    from = @{ name = "Ebenova Solutions"; email = "api@ebenova.dev" }
    to   = @{ name = "Test Client"; email = "test@example.com" }
    items = @(
        @{ description = "API Starter Plan"; quantity = 1; unit_price = 29 }
    )
    currency = "USD"
    invoice_number = "INV-2026-001"
    type = "invoice"
} | ConvertTo-Json -Depth 5

$headers = @{
    "Authorization" = "Bearer sk_live_9d23da78d0a2c029a17ab1d4c6051969427f96f29a4f782e"
    "Content-Type"  = "application/json"
}

$response = Invoke-RestMethod -Uri "https://api.ebenova.dev/v1/invoices/generate" -Method POST -Headers $headers -Body $body

Write-Host "SUCCESS: Invoice ID = $($response.invoice_id)"
Write-Host "Total: $($response.currency) $($response.total)"
Write-Host "HTML length: $($response.html.Length) chars"
Write-Host ""
Write-Host "Usage: $($response.usage.documents_used) / $($response.usage.monthly_limit) docs used"
