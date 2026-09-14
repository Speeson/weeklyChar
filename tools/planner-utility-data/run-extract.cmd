@echo off
setlocal
if "%~1"=="" (
  echo Uso:
  echo   run-extract.cmd "C:\ruta\a\simc.exe"
  exit /b 1
)
python "%~dp0extract.py" --simc "%~1"
if errorlevel 1 exit /b %errorlevel%
python "%~dp0validate.py"
exit /b %errorlevel%
