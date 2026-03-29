# ═══════════════════════════════════════════════════════════════
# SCOPE GUARD TEST SCRIPT
# ═══════════════════════════════════════════════════════════════
# This script will:
# 1. Create a test API key using your admin secret
# 2. Test the /v1/scope/analyze endpoint
# 3. Test the /v1/scope/change-order endpoint
# ═══════════════════════════════════════════════════════════════

# STEP 1: Get your EBENOVA_ADMIN_SECRET from Vercel dashboard
# Go to: vercel.com/ebenovasolu-5755s-projects/signova/settings/environment-variables
# Click the eye icon next to EBENOVA_ADMIN_SECRET to reveal it
# Then paste it below:

$ADMIN_SECRET = "Ec2UbMeJpjLq3GzDfTBZ0C9WP6sSNgOHX7m45udoYiVFlQIx1tRvk8yaAhrKnw"

# ═══════════════════════════════════════════════════════════════
# STEP 2: Create a test API key
# ═══════════════════════════════════════════════════════════════

Write-Host "`n═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "STEP 1: Creating test API key..." -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan

if ($ADMIN_SECRET -eq "PASTE_YOUR_EBENOVA_ADMIN_SECRET_HERE") {
    Write-Host "`nERROR: You need to paste your EBENOVA_ADMIN_SECRET above!" -ForegroundColor Red
    Write-Host "1. Go to Vercel dashboard" -ForegroundColor Yellow
    Write-Host "2. Find EBENOVA_ADMIN_SECRET" -ForegroundColor Yellow
    Write-Host "3. Click the eye icon to reveal it" -ForegroundColor Yellow
    Write-Host "4. Paste it in this script at line 14" -ForegroundColor Yellow
    exit
}

$keyBody = @{
    owner = "test@scope-guard.com"
    tier = "growth"
    label = "Scope Guard Test Key"
} | ConvertTo-Json -Depth 5

$keyHeaders = @{
    "Authorization" = "Bearer $ADMIN_SECRET"
    "Content-Type" = "application/json"
}

try {
    $keyResponse = Invoke-RestMethod -Uri "https://api.ebenova.dev/v1/keys/create" `
        -Method POST `
        -Headers $keyHeaders `
        -Body $keyBody
    
    Write-Host "`n✅ API Key created successfully!" -ForegroundColor Green
    Write-Host "Key: $($keyResponse.api_key)" -ForegroundColor White
    Write-Host "Tier: $($keyResponse.tier)" -ForegroundColor White
    Write-Host "Monthly Limit: $($keyResponse.monthly_limit)" -ForegroundColor White
    
    $API_KEY = $keyResponse.api_key
} catch {
    Write-Host "`n❌ Failed to create API key: $_" -ForegroundColor Red
    Write-Host "`nMake sure:" -ForegroundColor Yellow
    Write-Host "1. EBENOVA_ADMIN_SECRET is correct" -ForegroundColor Yellow
    Write-Host "2. Your Vercel deployment is up to date" -ForegroundColor Yellow
    Write-Host "3. Redis connection is working" -ForegroundColor Yellow
    exit
}

# ═══════════════════════════════════════════════════════════════
# STEP 3: Test /v1/scope/analyze endpoint
# ═══════════════════════════════════════════════════════════════

Write-Host "`n═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "STEP 2: Testing /v1/scope/analyze..." -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan

$analyzeBody = @{
    contract_text = "This Freelance Agreement is between John Doe (Freelancer) and Acme Inc (Client). Scope: Build a 5-page website including homepage, about, services, portfolio, and contact page. Timeline: 4 weeks. Cost: $3,000 USD. Revisions: 2 rounds included. Additional work requires written change order."
    client_message = "Can you also add a login page with user authentication?"
    communication_channel = "email"
} | ConvertTo-Json -Depth 5

$analyzeHeaders = @{
    "Authorization" = "Bearer $API_KEY"
    "Content-Type" = "application/json"
}

try {
    $analyzeResponse = Invoke-RestMethod -Uri "https://api.ebenova.dev/v1/scope/analyze" `
        -Method POST `
        -Headers $analyzeHeaders `
        -Body $analyzeBody
    
    Write-Host "`n✅ Analysis successful!" -ForegroundColor Green
    Write-Host "`nViolation Detected: $($analyzeResponse.violation_detected)" -ForegroundColor White
    Write-Host "Violations Found: $($analyzeResponse.violations.Count)" -ForegroundColor White
    Write-Host "Summary: $($analyzeResponse.summary)" -ForegroundColor White
    
    if ($analyzeResponse.violations.Count -gt 0) {
        Write-Host "`n--- Violations ---" -ForegroundColor Yellow
        foreach ($v in $analyzeResponse.violations) {
            Write-Host "  Type: $($v.type) | Severity: $($v.severity)" -ForegroundColor Yellow
            Write-Host "  Description: $($v.description)" -ForegroundColor Yellow
        }
    }
    
    if ($analyzeResponse.response_options.Count -gt 0) {
        Write-Host "`n--- Response Options ---" -ForegroundColor Cyan
        foreach ($opt in $analyzeResponse.response_options) {
            $rec = if ($opt.recommended) { " ⭐ RECOMMENDED" } else { "" }
            Write-Host "`n$($opt.label)$rec" -ForegroundColor Cyan
            Write-Host "Draft: $($opt.draft.Substring(0, [Math]::Min(100, $opt.draft.Length)))..." -ForegroundColor Gray
        }
    }
    
    if ($analyzeResponse.usage) {
        Write-Host "`n--- Usage ---" -ForegroundColor Green
        Write-Host "Documents Used: $($analyzeResponse.usage.documents_used)" -ForegroundColor Green
        Write-Host "Documents Remaining: $($analyzeResponse.usage.documents_remaining)" -ForegroundColor Green
    }
    
    # Save full response to file
    $analyzeResponse | ConvertTo-Json -Depth 10 | Out-File -FilePath "scope-analyze-response.json"
    Write-Host "`n💾 Full response saved to: scope-analyze-response.json" -ForegroundColor Gray
    
} catch {
    Write-Host "`n❌ Analysis failed: $_" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "Response: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
}

# ═══════════════════════════════════════════════════════════════
# STEP 4: Test /v1/scope/change-order endpoint
# ═══════════════════════════════════════════════════════════════

Write-Host "`n═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "STEP 3: Testing /v1/scope/change-order..." -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan

$changeOrderBody = @{
    additional_work = "Login page with user authentication including registration, login form, password reset, and user dashboard"
    additional_cost = 800
    freelancer_name = "John Doe Freelancing"
    client_name = "Acme Inc."
    currency = "USD"
    timeline_extension_days = 7
    jurisdiction = "United States - California"
} | ConvertTo-Json -Depth 5

$changeOrderHeaders = @{
    "Authorization" = "Bearer $API_KEY"
    "Content-Type" = "application/json"
}

try {
    $changeOrderResponse = Invoke-RestMethod -Uri "https://api.ebenova.dev/v1/scope/change-order" `
        -Method POST `
        -Headers $changeOrderHeaders `
        -Body $changeOrderBody
    
    Write-Host "`n✅ Change Order generated successfully!" -ForegroundColor Green
    Write-Host "`nFreelancer: $($changeOrderResponse.change_order_details.freelancer_name)" -ForegroundColor White
    Write-Host "Client: $($changeOrderResponse.change_order_details.client_name)" -ForegroundColor White
    Write-Host "Additional Cost: $($changeOrderResponse.change_order_details.currency) $($changeOrderResponse.change_order_details.additional_cost)" -ForegroundColor White
    Write-Host "Timeline Extension: $($changeOrderResponse.change_order_details.timeline_extension_days) days" -ForegroundColor White
    
    if ($changeOrderResponse.usage) {
        Write-Host "`n--- Usage ---" -ForegroundColor Green
        Write-Host "Documents Used: $($changeOrderResponse.usage.documents_used)" -ForegroundColor Green
        Write-Host "Documents Remaining: $($changeOrderResponse.usage.documents_remaining)" -ForegroundColor Green
    }
    
    # Save full response to file
    $changeOrderResponse | ConvertTo-Json -Depth 10 | Out-File -FilePath "scope-change-order-response.json"
    Write-Host "`n💾 Full response saved to: scope-change-order-response.json" -ForegroundColor Gray
    
    # Show first 500 chars of document
    Write-Host "`n--- Document Preview ---" -ForegroundColor Cyan
    Write-Host $changeOrderResponse.document.Substring(0, [Math]::Min(500, $changeOrderResponse.document.Length)) -ForegroundColor Gray
    Write-Host "...(see scope-change-order-response.json for full document)" -ForegroundColor Gray
    
} catch {
    Write-Host "`n❌ Change Order generation failed: $_" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "Response: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
}

# ═══════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════

Write-Host "`n═══════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "TEST COMPLETE" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "`nYour API Key: $API_KEY" -ForegroundColor White
Write-Host "Save this key for future testing!" -ForegroundColor Yellow
Write-Host "`nOutput files:" -ForegroundColor Gray
Write-Host "  - scope-analyze-response.json" -ForegroundColor Gray
Write-Host "  - scope-change-order-response.json" -ForegroundColor Gray
