# Decode base64 og-image and place in Signova public folder
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$b64Path = Join-Path $scriptDir "og-image-b64.txt"

if (-Not (Test-Path $b64Path)) {
    Write-Error "og-image-b64.txt not found at $b64Path"
    exit 1
}

$b64 = (Get-Content -Path $b64Path -Raw).Trim()
$bytes = [System.Convert]::FromBase64String($b64)
$destPath = "C:\projects\signova\public\og-image.png"
[System.IO.File]::WriteAllBytes($destPath, $bytes)
Write-Output "SUCCESS: og-image.png written to $destPath ($($bytes.Length) bytes)"
