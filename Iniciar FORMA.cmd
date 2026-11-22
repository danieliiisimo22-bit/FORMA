@echo off
setlocal
if exist "%~dp0forma.exe" (
    "%~dp0forma.exe"
) else if exist "%~dp0target\release\forma.exe" (
    "%~dp0target\release\forma.exe"
) else if exist "%~dp0release\1.2.0-preview.1\FORMA-1.2.0-preview.1-Windows-x64\forma.exe" (
    "%~dp0release\1.2.0-preview.1\FORMA-1.2.0-preview.1-Windows-x64\forma.exe"
) else (
    echo Falta el ejecutable. Ejecuta Compilar.ps1 o usa la carpeta portable de FORMA.
    pause
    exit /b 1
)
if errorlevel 1 pause
