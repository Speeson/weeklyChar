@echo off
setlocal
cd /d "%~dp0"

set "APP_VERSION="
for /f "usebackq tokens=* delims=" %%v in ("VERSION") do set "APP_VERSION=%%v"
if "%APP_VERSION%"=="" set "APP_VERSION=0.1.0"

echo Building KeystoneClient %APP_VERSION%...
pyinstaller --noconfirm --clean --onedir --windowed --name KeystoneClient --icon icon.ico --add-data "icon.ico;." --add-data "bg.jpg;." --add-data "VERSION;." main.py
if errorlevel 1 exit /b 1

if not exist installer mkdir installer
> installer\version.ini echo [Version]
>> installer\version.ini echo AppVersion=%APP_VERSION%

where iscc >nul 2>nul
if errorlevel 1 (
    echo.
    echo Inno Setup Compiler no encontrado.
    echo Instala Inno Setup y vuelve a ejecutar este script:
    echo https://jrsoftware.org/isdl.php
    exit /b 1
)

iscc installer\KeystoneClient.iss
if errorlevel 1 exit /b 1

echo.
echo Build completado: installer\output\KeystoneClientSetup.exe
