@echo off
setlocal
cd /d "%~dp0"

where docker >nul 2>nul
if errorlevel 1 (
  echo Docker Desktop is required for the integrated offline AI/media tools.
  echo You can still open index.html or run run-local.bat for manual subtitle editing.
  echo Install Docker Desktop, open it, then run this file again.
  pause
  exit /b 1
)

docker compose version >nul 2>nul
if errorlevel 1 (
  echo Docker Compose is unavailable. Please update Docker Desktop.
  pause
  exit /b 1
)

echo.
echo Hendy VietSub Offline Studio v2.2.0
echo First build downloads the open-source offline translation and Whisper models.
echo This can be a large download. At runtime, translation does not call a third-party API.
echo.

docker compose up --build -d
if errorlevel 1 (
  echo Build or startup failed. Review the Docker output above.
  pause
  exit /b 1
)

echo.
echo Studio: http://localhost:8080
echo Backend health: http://localhost:10000/health
echo To stop the services later, run: docker compose down
echo.
start "" http://localhost:8080
pause
