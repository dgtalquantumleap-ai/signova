Set-Location 'C:\projects\signova'

$prices = @(
  @{ name='STRIPE_PRICE_INSIGHTS_STARTER'; value='price_1THvNrJlikfX3kyVZqMKLymi' },
  @{ name='STRIPE_PRICE_INSIGHTS_GROWTH';  value='price_1THvODJlikfX3kyVNhblRBnu' },
  @{ name='STRIPE_PRICE_INSIGHTS_SCALE';   value='price_1THvODJlikfX3kyVF6W2fXCf' }
)

foreach ($p in $prices) {
  Write-Host "Adding $($p.name)"
  $tmp = [System.IO.Path]::GetTempFileName()
  [System.IO.File]::WriteAllText($tmp, $p.value)
  Get-Content -Raw $tmp | vercel env add $p.name production 2>&1
  Remove-Item $tmp
}

Write-Host "Verifying:"
vercel env ls 2>&1 | Select-String 'INSIGHTS'
