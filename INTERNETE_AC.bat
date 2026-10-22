@echo off
chcp 65001 >nul
title Civciv Kiyameti - Internet baglantisi
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\internete-ac.ps1"
pause
