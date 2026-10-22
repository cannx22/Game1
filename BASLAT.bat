@echo off
chcp 65001 >nul
title Civciv Kiyameti - Sunucu
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js bulunamadi! https://nodejs.org adresinden LTS surumunu kurup bu dosyayi tekrar calistir.
  start https://nodejs.org
  pause
  exit /b 1
)

if not exist node_modules (
  echo  Ilk kurulum yapiliyor, biraz bekle...
  call npm install --omit=dev
  if errorlevel 1 (
    echo  Kurulum basarisiz oldu. Internet baglantini kontrol et.
    pause
    exit /b 1
  )
)

rem open the game in the browser once the server has had a moment to start
start "" cmd /c "timeout /t 3 >nul & start http://localhost:4747"
node server/index.js
pause
