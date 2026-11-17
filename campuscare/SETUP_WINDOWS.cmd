@echo off
cd /d "%~dp0"
echo.
echo === CampusCare Clean Level 3 Setup ===
echo Keep Docker Desktop open. Your old database will NOT be deleted.
echo.
call npm install
if errorlevel 1 goto fail
call npm run setup:fresh
if errorlevel 1 goto fail
echo.
echo Setup complete! Run START_WINDOWS.cmd or npm run dev.
pause
exit /b 0
:fail
echo.
echo Setup failed. Take a screenshot of the error and send it to ChatGPT.
pause
exit /b 1
