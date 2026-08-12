@echo off
setlocal EnableExtensions
title WeiXun Project Server

set "PROJECT_ROOT=%~dp0"
set "APP_DIR=%PROJECT_ROOT%projects"
set "APP_PORT=%WEIXUN_PORT%"
if not defined APP_PORT set "APP_PORT=5000"
set "APP_URL=http://127.0.0.1:%APP_PORT%/"

echo.
echo ========================================
echo   WeiXun Project - One Click Start
echo ========================================
echo.

if not exist "%APP_DIR%\package.json" (
  echo [ERROR] Application directory was not found:
  echo         %APP_DIR%
  goto :failed
)

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found in PATH.
  echo         Install Node.js 20 or newer, then try again.
  goto :failed
)

cd /d "%APP_DIR%"

if not exist ".env.local" (
  echo [ERROR] projects\.env.local was not found.
  echo         Copy .env.example to .env.local and fill in the required values.
  goto :failed
)

if not exist "node_modules\.bin\tsx.cmd" (
  echo [ERROR] Project dependencies are missing.
  echo         Open PowerShell in the projects directory and run: pnpm install
  goto :failed
)

netstat -ano | findstr /R /C:":%APP_PORT% .*LISTENING" >nul
if not errorlevel 1 (
  echo [OK] The service is already running at %APP_URL%
  if not "%WEIXUN_SKIP_BROWSER%"=="1" start "" "%APP_URL%"
  goto :success
)

echo [1/3] Checking environment configuration...
call "node_modules\.bin\tsx.cmd" scripts\check-local-env.ts
if errorlevel 1 goto :failed

if not exist ".next\BUILD_ID" goto :build
if not exist "dist\server.js" goto :build
goto :build_ready

:build
echo [2/3] Production build was not found. Building now...
call "node_modules\.bin\next.cmd" build
if errorlevel 1 goto :failed
call "node_modules\.bin\tsup.cmd" src\server.ts --format cjs --platform node --target node20 --outDir dist --no-splitting --no-minify
if errorlevel 1 goto :failed
goto :start_server

:build_ready
echo [2/3] Existing production build is ready.

:start_server
echo [3/3] Starting service at %APP_URL%
echo.
echo Keep this window open while using the application.
echo Press Ctrl+C or close this window to stop the service.
echo.

if not "%WEIXUN_SKIP_BROWSER%"=="1" (
  start "" powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process '%APP_URL%'"
)

set "NODE_ENV=production"
set "HOSTNAME=127.0.0.1"
set "PORT=%APP_PORT%"
node dist\server.js
if errorlevel 1 goto :failed
goto :success

:failed
echo.
echo [FAILED] The service did not start. Read the message above.
pause
exit /b 1

:success
echo.
echo [DONE]
exit /b 0
