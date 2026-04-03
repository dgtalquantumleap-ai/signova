# set-insights-env.ps1
# Sets Stripe Insights price IDs using vercel CLI.
# Writes each value to a temp file (no pipe = no CRLF contamination).

$vars = @{
  "STRIPE_PRICE_INSIGHTS_STARTER" = "price_1THvNrJlikfX3kyVZqMKLymi"
  "STRIPE_PRICE_INSIGHTS_GROWTH"  = "price_1THvODJlikfX3kyVNhblRBnu"
  "STRIPE_PRICE_INSIGHTS_SCALE"   = "price_1THvODJlikfX3kyVF6W2fXCf"
}

$tmpFile = "$env:TEMP\vercel_val.txt"

foreach ($key in $vars.Keys) {
  $val = $vars[$key]
  Write-Host "Setting $key = $val"

  # Write value with NO trailing newline using .NET directly
  [System.IO.File]::WriteAllText($tmpFile, $val)

  # Feed to vercel env add via stdin redirect (no pipe, no CRLF)
  $result = cmd /c "vercel env add $key production < `"$tmpFile`"" 2>&1
  Write-Host "  -> $result"
}

# Clean up
Remove-Item $tmpFile -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Done. Run: vercel --prod --yes" -ForegroundColor Cyan
