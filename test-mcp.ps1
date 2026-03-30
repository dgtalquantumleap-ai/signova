$body = '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smithery","version":"1"}}}'
$r = Invoke-RestMethod -Uri 'https://www.getsignova.com/api/mcp' -Method POST -ContentType 'application/json' -Body $body
$r | ConvertTo-Json -Depth 5
Write-Host ""
Write-Host "--- tools/list ---"
$body2 = '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
$r2 = Invoke-RestMethod -Uri 'https://www.getsignova.com/api/mcp' -Method POST -ContentType 'application/json' -Body $body2
$r2 | ConvertTo-Json -Depth 5
