@echo off
cd /d "%~dp0"
pyinstaller --onefile --windowed --name KeystoneClient --icon icon.ico --add-data "addon;addon" --add-data "icon.ico;." --add-data "bg.jpg;." --add-data "VERSION;." main.py
echo.
echo Build completado. El ejecutable esta en dist\KeystoneClient.exe
pause
