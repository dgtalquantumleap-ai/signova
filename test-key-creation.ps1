# Test API key creation with debug output

$ADMIN_SECRET = "Ec2UbMeJpjLq3GzDfTBZ0C9WP6sSNgOHX7m45udoYiVFlQIx1tRvk8yaAhrKnw"

Write-Host "Creating API key..." -ForegroundColor Cyan

$body = @{
    owner = "test@scope-guard.com"
    tier = "growth"
    label = "Scope Guard Test"
} | ConvertTo-Json -Depth 5

$headers = @{
    "Authorization" = "Bearer $ADMIN_SECRET"
    "Content-Type" = "application/json"
}

Write-Host "Request URL: https://api.ebenova.dev/v1/keys/create" -ForegroundColor Gray
Write-Host "Request Body: $body" -ForegroundColor Gray

try {
    $response = Invoke-RestMethod -Uri "https://api.ebenova.dev/v1/keys/create" `
        -Method POST `
        -Headers $headers `
        -Body $body
    
    Write-Host "`n=== RAW RESPONSE ===" -ForegroundColor Green
    Write-Host ($response | ConvertTo-Json -Depth 5) -ForegroundColor White
    
    Write-Host "`n=== PARSED VALUES ===" -ForegroundColor Green
    Write-Host "success: $($response.success)" -ForegroundColor White
    Write-Host "api_key: $($response.api_key)" -ForegroundColor White
    Write-Host "owner: $($response.owner)" -ForegroundColor White
    Write-Host "tier: $($response.tier)" -ForegroundColor White
    Write-Host "monthly_limit: $($response.monthly_limit)" -ForegroundColor White
    
} catch {
    Write-Host "`n=== ERROR ===" -ForegroundColor Red
    Write-Host "Status: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    Write-Host "Message: $($_.ErrorDetails.Message)" -ForegroundColor Red
}
