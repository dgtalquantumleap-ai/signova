$key  = "sk_live_9d23da78d0a2c029a17ab1d4c6051969427f96f29a4f782e"
$base = "https://api.ebenova.dev"
$h    = @{ "Authorization" = "Bearer $key"; "Content-Type" = "application/json" }
$pass = 0; $fail = 0

function Pass($label, $detail = "") {
    Write-Host "  PASS  $label" -ForegroundColor Green
    if ($detail) { Write-Host "        $detail" -ForegroundColor DarkGray }
    $script:pass++
}
function Fail($label, $detail = "") {
    Write-Host "  FAIL  $label" -ForegroundColor Red
    if ($detail) { Write-Host "        $detail" -ForegroundColor DarkGray }
    $script:fail++
}
function Req($method, $path, $body = $null) {
    $p = @{ Uri = "$base$path"; Method = $method; Headers = $h; TimeoutSec = 45 }
    if ($body) { $p.Body = ($body | ConvertTo-Json -Depth 5) }
    return Invoke-RestMethod @p
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  EBENOVA API  -  LIVE ENDPOINT TEST" -ForegroundColor Cyan
Write-Host "  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan
Write-Host "==========================================`n" -ForegroundColor Cyan

# 1 - Document types (no auth)
Write-Host "-- PUBLIC (no auth) ----------------------"
try {
    $r = Invoke-RestMethod -Uri "$base/v1/documents/types" -TimeoutSec 15
    $n = $r.total
    Pass "GET /v1/documents/types" "$n document types returned"
} catch { Fail "GET /v1/documents/types" $_.Exception.Message }

# 2 - Key usage
Write-Host "`n-- AUTH REQUIRED -------------------------"
try {
    $r = Req "GET" "/v1/keys/usage"
    $tier  = $r.key.tier
    $used  = $r.current_month.documents_used
    $limit = $r.current_month.monthly_limit
    Pass "GET /v1/keys/usage" "Tier: $tier | Used: $used / $limit"
} catch { Fail "GET /v1/keys/usage" $_.Exception.Message }

# 3 - Document generation
try {
    $r = Req "POST" "/v1/documents/generate" @{
        document_type = "nda"
        fields = @{ disclosingParty = "Test Corp"; receivingParty = "John Doe"; purpose = "API test"; duration = "1 year" }
        jurisdiction = "Nigeria"
    }
    $len = $r.document.Length
    Pass "POST /v1/documents/generate" "NDA generated - $len chars"
} catch { Fail "POST /v1/documents/generate" $_.Exception.Message }

# 4 - Conversation extraction
try {
    $r = Req "POST" "/v1/extract/conversation" @{
        conversation    = "John: I will rent the flat at 14 Admiralty Way for 1.2M per year. Tenant is Mary Smith."
        target_document = "tenancy-agreement"
        auto_generate   = $false
    }
    $count = ($r.extracted_fields.PSObject.Properties | Measure-Object).Count
    Pass "POST /v1/extract/conversation" "$count fields extracted | suggested: $($r.suggested_document)"
} catch { Fail "POST /v1/extract/conversation" $_.Exception.Message }

# 5 - Invoice generation
try {
    $r = Req "POST" "/v1/invoices/generate" @{
        type = "invoice"
        from = @{ name = "Ebenova Solutions"; email = "api@ebenova.dev" }
        to   = @{ name = "Test Client" }
        items = @( @{ description = "API Starter Plan"; quantity = 1; unit_price = 29 } )
        currency       = "USD"
        invoice_number = "INV-TEST-001"
    }
    $id    = $r.invoice_id
    $total = $r.total
    $cur   = $r.currency
    Pass "POST /v1/invoices/generate" "Invoice $id | Total: $cur $total"
} catch { Fail "POST /v1/invoices/generate" $_.Exception.Message }

# 6 - Scope Guard - analyze
Write-Host "`n-- SCOPE GUARD ---------------------------"
try {
    $r = Req "POST" "/v1/scope/analyze" @{
        contract_text = "FREELANCE CONTRACT: Developer builds 5-page website. Deliverables: Home, About, Services, Portfolio, Contact. 3 revision rounds. Fixed price USD 5000. Timeline 30 days."
        client_message = "Hey can you also add a blog and a mobile app? Should be quick!"
        communication_channel = "email"
    }
    $vcount = $r.violations.Count
    $detected = $r.violation_detected
    Pass "POST /v1/scope/analyze" "Violations: $vcount | Detected: $detected"
} catch {
    $code = $_.Exception.Response.StatusCode.Value__
    if ($code -eq 403) { Fail "POST /v1/scope/analyze" "403 - Growth tier required (expected for free key)" }
    else { Fail "POST /v1/scope/analyze" $_.Exception.Message }
}

# 7 - Scope Guard - change order
try {
    $r = Req "POST" "/v1/scope/change-order" @{
        freelancer_name        = "John Dev"
        client_name            = "Acme Corp"
        additional_work        = "Blog section and mobile app"
        additional_cost        = 3500
        currency               = "USD"
        timeline_extension_days = 14
        jurisdiction           = "Nigeria"
    }
    $len = $r.document.Length
    Pass "POST /v1/scope/change-order" "Change order generated - $len chars"
} catch {
    $code = $_.Exception.Response.StatusCode.Value__
    if ($code -eq 403) { Fail "POST /v1/scope/change-order" "403 - Growth tier required (expected for free key)" }
    else { Fail "POST /v1/scope/change-order" $_.Exception.Message }
}

# 8 - Auth error check
Write-Host "`n-- SECURITY ------------------------------"
try {
    Invoke-RestMethod -Uri "$base/v1/keys/usage" -Method GET -Headers @{"Content-Type"="application/json"} -TimeoutSec 10 | Out-Null
    Fail "Missing auth should return 401" "Got 200 instead - security issue"
} catch {
    $code = $_.Exception.Response.StatusCode.Value__
    if ($code -eq 401) { Pass "No auth correctly returns 401" }
    else { Fail "Expected 401 on missing auth" "Got: $code" }
}

# Summary
Write-Host "`n==========================================" -ForegroundColor Cyan
$color = if ($fail -eq 0) { "Green" } else { "Yellow" }
Write-Host "  RESULTS:  $pass passed   $fail failed" -ForegroundColor $color
Write-Host "==========================================`n" -ForegroundColor Cyan
