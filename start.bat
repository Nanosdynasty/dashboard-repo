@echo off
REM One-click start script for Global Energy Transition Dashboard (Windows)
cd /d "%~dp0"

echo ==============================================
echo   Global Energy Transition Dashboard
echo   GEM-style multi-tracker platform
echo ==============================================
echo.

REM Check Python
where python >nul 2>&1
if errorlevel 1 (
    echo ERROR: python not found. Please install Python 3.10+ from https://python.org
    echo Make sure to check "Add Python to PATH" during installation.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('python --version 2^>^&1') do set PYVER=%%i
echo Using: %PYVER%

REM Create virtual environment if missing
if not exist ".venv" (
    echo Creating virtual environment (.venv)...
    python -m venv .venv
)

REM Activate
call .venv\Scripts\activate.bat

echo Installing / updating dependencies...
python -m pip install --upgrade pip -q
pip install -r requirements.txt -q

echo.
echo Starting server on http://localhost:8000
echo Press Ctrl+C to stop.
echo.

REM Open browser after short delay
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:8000"

uvicorn app:app --host 127.0.0.1 --port 8000 --reload

pause
