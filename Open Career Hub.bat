@echo off
rem Starts a tiny local web server for this folder and opens the Career Hub.
rem Needed for full-photo team-card exports (browsers block copying file:// photos into images).
rem Your save lives in the browser for http://127.0.0.1:5178 - use Edit Career > Import / Export to move a save made via file://.
cd /d "%~dp0"
where python >nul 2>nul || (echo Python was not found. Opening the page directly instead. & start "" "%~dp0index.html" & exit /b)
start "Career Hub server (close to stop)" /min python -m http.server 5178 --bind 127.0.0.1
timeout /t 1 /nobreak >nul
start "" http://127.0.0.1:5178/
