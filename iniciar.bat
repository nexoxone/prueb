@echo off
cd /d "%~dp0"
echo Abriendo http://localhost:8000 ...
start "" http://localhost:8000
where py >nul 2>nul && (py -m http.server 8000) || (python -m http.server 8000)
