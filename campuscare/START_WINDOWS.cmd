@echo off
cd /d "%~dp0"
echo CampusCare opens at http://localhost:3100/login
echo Keep this window open while using the website.
call npm run dev
pause
