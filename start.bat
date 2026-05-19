@echo off
REM ============================================================
REM DocMind RAG App — Windows Quick Start
REM Usage: Double-click start.bat OR run in CMD
REM ============================================================

echo.
echo ╔══════════════════════════════════════╗
echo ║     DocMind RAG App — Quick Start    ║
echo ╚══════════════════════════════════════╝
echo.

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found. Download from https://python.org
    pause & exit /b 1
)

REM Check Node
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js not found. Download from https://nodejs.org
    pause & exit /b 1
)

REM Backend setup
echo Setting up backend...
cd backend

if not exist venv (
    python -m venv venv
)

call venv\Scripts\activate.bat

pip install -r requirements.txt -q

if not exist .env (
    copy .env.example .env
    echo.
    echo ================================================================
    echo  ACTION REQUIRED: Open backend\.env and set your OpenAI key:
    echo  OPENAI_API_KEY=sk-your-key-here
    echo ================================================================
    echo.
    notepad .env
    pause
)

cd ..

REM Frontend setup
echo Setting up frontend...
cd frontend
if not exist node_modules (
    npm install --silent
)
cd ..

REM Start servers in separate windows
echo.
echo Starting servers...
echo.
echo Backend: http://localhost:8000
echo Frontend: http://localhost:3000
echo API Docs: http://localhost:8000/docs
echo.

start "DocMind Backend" cmd /k "cd backend && venv\Scripts\activate && uvicorn main:app --reload --port 8000"
timeout /t 3 /nobreak >nul
start "DocMind Frontend" cmd /k "cd frontend && npm run dev -- --port 3000"
timeout /t 4 /nobreak >nul

start http://localhost:3000

echo.
echo Both servers are running in separate windows.
echo Close those windows to stop the servers.
echo.
pause
