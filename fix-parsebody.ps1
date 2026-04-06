# Fix all files with duplicated parseBody function
$files = @(
  "api\generate.js",
  "api\mcp.js",
  "api\oxapay-checkout.js",
  "api\scope-guard-analyze.js",
  "api\stripe-verify.js",
  "api\v1\invoices\generate.js",
  "api\v1\vigil\report.js",
  "api\v1\insights\subscribe.js",
  "api\v1\vigil\authorize.js",
  "api\v1\vigil\analyze.js",
  "api\v1\scope\change-order.js",
  "api\v1\insights\monitors\create.js",
  "api\v1\scope\analyze.js",
  "api\v1\billing\portal.js",
  "api\v1\insights\matches\feedback.js",
  "api\v1\billing\checkout.js",
  "api\v1\insights\matches\draft.js",
  "api\v1\extract\conversation.js",
  "api\v1\contracts\link.js",
  "api\v1\documents\batch.js",
  "api\v1\auth\verify.js"
)

foreach ($file in $files) {
  $path = Join-Path $PSScriptRoot $file
  if (Test-Path $path) {
    $content = Get-Content $path -Raw
    
    # Check if already has import
    if ($content -match "import.*parseBody.*from.*lib/parse-body") {
      Write-Host "✓ $file - already has import, skipping"
      continue
    }
    
    # Remove the local parseBody function (multi-line)
    $content = $content -replace "(?m)^async function parseBody\(req\) \{[^}]+\}(?:\r?\n)?", ""
    
    # Add import at the top of existing imports
    $content = $content -replace "^(import .+)$", "`$1`nimport { parseBody } from '../../../lib/parse-body.js'", 1
    
    # Fix relative path depth for files in api/v1/
    if ($file -match "api\\v1\\") {
      $content = $content -replace "import \{ parseBody \} from '\.\./\.\./\.\./lib/parse-body\.js'", "import { parseBody } from '../../../lib/parse-body.js'"
    }
    
    Set-Content -Path $path -Value $content -NoNewline
    Write-Host "✓ Fixed $file"
  } else {
    Write-Host "✗ File not found: $file"
  }
}

Write-Host "`nDone!"
