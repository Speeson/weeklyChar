@echo off
pyinstaller --onefile --windowed --name KeystoneClient --add-data "addon;addon" main.py
echo.
echo Build completado. El ejecutable esta en dist\KeystoneClient.exe
pause
