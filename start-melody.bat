@echo off
cd /d "%~dp0"

start "" cmd /c "timeout /t 3 /nobreak >nul && start "" http://localhost:5173"

npm run dev

pause
