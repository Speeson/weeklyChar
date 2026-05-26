@echo off
pyinstaller --onefile --windowed --name KeystoneClient main.py
echo.
echo Build completado. El ejecutable esta en dist\KeystoneClient.exe
pause
