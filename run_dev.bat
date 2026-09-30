@echo off
title Wallet Intelligence Launcher
echo ========================================================
echo        SOLANA WALLET INTELLIGENCE & ANALYZER
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/3] Checking PostgreSQL service...
netstat -ano | findstr :5432 >nul
if %errorlevel% neq 0 (
    echo [INFO] Starting PostgreSQL server from Laragon...
    if exist "D:\laragon\bin\postgresql\postgresql-14.5-1\bin\pg_ctl.exe" (
        "D:\laragon\bin\postgresql\postgresql-14.5-1\bin\pg_ctl.exe" start -D "D:\laragon\data\postgresql-14"
    ) else (
        echo [WARNING] Please ensure PostgreSQL is running in Laragon!
    )
) else (
    echo [OK] PostgreSQL is already running on port 5432.
)
echo.

echo [2/3] Launching FastAPI Backend (Port 8000)...
start "Wallet Intelligence API" cmd /k "cd /d %~dp0 && .venv\Scripts\python -m uvicorn apps.api.main:app --host 127.0.0.1 --port 8000 --reload"

echo [3/3] Launching Next.js Frontend (Port 3000)...
start "Wallet Intelligence Web" cmd /k "cd /d %~dp0\apps\web && npm run dev"

echo.
echo ========================================================
echo  System is running!
echo  - Frontend Dashboard : http://localhost:3000
echo  - Backend API Docs   : http://localhost:8000/docs
echo ========================================================
echo.
pause
