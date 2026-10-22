@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  echo Hendy VietSub Tools is available at http://localhost:8080
  start "Hendy VietSub Tools" http://localhost:8080
  py -m http.server 8080
  exit /b %errorlevel%
)
where python >nul 2>nul
if %errorlevel%==0 (
  echo Hendy VietSub Tools is available at http://localhost:8080
  start "Hendy VietSub Tools" http://localhost:8080
  python -m http.server 8080
  exit /b %errorlevel%
)
echo Python is required to start a local static server. You can also open index.html directly.
pause
