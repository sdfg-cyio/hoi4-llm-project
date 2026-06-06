@echo off
chcp 65001 >nul
title HOI4 Newspaper
cd /d "%~dp0"

set "NODE="
if exist "%~dp0node.exe" (
    set "NODE=%~dp0node.exe"
) else (
    where node >nul 2>nul
    if %errorlevel% equ 0 (
        set "NODE=node"
    ) else (
        echo ========================================
        echo   [ERROR] node.exe not found!
        echo ========================================
        echo.
        echo   Please download Node.js from:
        echo   https://nodejs.org/en/download/prebuilt-binaries
        echo   Extract node.exe into this folder.
        echo.
        pause
        exit /b 1
    )
)

if not exist "%~dp0runtime" mkdir "%~dp0runtime"
if not exist "%~dp0runtime\settings.json" (
    copy "%~dp0runtime\settings.example.json" "%~dp0runtime\settings.json" >nul
)

echo ========================================
echo   HOI4 Newspaper - Running
echo   Open http://localhost:3000 in browser
echo ========================================
echo.
"%NODE%" watcher.mjs
pause
