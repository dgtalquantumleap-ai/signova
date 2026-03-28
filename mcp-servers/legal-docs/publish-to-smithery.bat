@echo off
REM ═══════════════════════════════════════════════════════════════
REM SMITHERY PUBLISHING SCRIPT
REM ═══════════════════════════════════════════════════════════════
REM 
REM This script helps you publish the Ebenova MCP server to Smithery.
REM 
REM ═══════════════════════════════════════════════════════════════

echo.
echo ═══════════════════════════════════════════════════════════════
echo  EBENOVA MCP SERVER — SMITHERY PUBLISHING
echo ═══════════════════════════════════════════════════════════════
echo.

REM Check if Smithery CLI is installed
where smithery >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [!] Smithery CLI not found. Installing...
    npm install -g @smithery/cli
    echo.
)

echo STEP 1: Get Your Smithery API Key
echo ═══════════════════════════════════════════════════════════════
echo.
echo Please visit: https://smithery.ai/account/api-keys
echo Login with your Google account (dgtalquantumleap@gmail.com)
echo Create a new API key and copy it.
echo.
set /p SMITHERY_API_KEY="Paste your Smithery API key: "
echo.

REM Validate API key was entered
if "%SMITHERY_API_KEY%"=="" (
    echo [ERROR] No API key entered. Please try again.
    pause
    exit /b 1
)

echo.
echo STEP 2: Publishing to Smithery...
echo ═══════════════════════════════════════════════════════════════
echo.

REM Change to MCP server directory
cd /d "%~dp0"

REM Set API key as environment variable
set SMITHERY_API_KEY=%SMITHERY_API_KEY%

REM Publish
echo Publishing now...
echo.
smithery publish

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ═══════════════════════════════════════════════════════════════
    echo  SUCCESS! Your MCP server is published to Smithery.
    echo ═══════════════════════════════════════════════════════════════
    echo.
    echo Next steps:
    echo 1. Visit: https://smithery.ai/server/@ebenova/legal-docs-mcp
    echo 2. Add Smithery badge to GitHub README
    echo 3. Share on social media!
    echo.
) else (
    echo.
    echo ═══════════════════════════════════════════════════════════════
    echo  Publishing failed. Try the alternative method:
    echo ═══════════════════════════════════════════════════════════════
    echo.
    echo 1. Create GitHub repo:
    echo    gh repo create ebenova/legal-docs-mcp --public --source=. --push
    echo.
    echo 2. Submit to Smithery:
    echo    https://smithery.ai/publish
    echo.
    echo 3. Enter repo URL: https://github.com/ebenova/legal-docs-mcp
    echo.
)

pause
