@echo off
REM AOP Network Visualizer - Windows Startup Script

echo  Starting AOP Network Visualizer...
echo.

REM Check for required dependencies
echo  Checking dependencies...

where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo  Node.js is not installed. Please install Node.js 16+ from https://nodejs.org/
    pause
    exit /b 1
)

where python >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo  Python is not installed. Please install Python 3.8+ from https://python.org/
    pause
    exit /b 1
)

where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo  npm is not installed. Please install npm (usually comes with Node.js)
    pause
    exit /b 1
)

echo All dependencies found!
echo.

REM Setup and start backend
echo  Setting up Python backend...
cd backend

REM Create virtual environment if it doesn't exist
if not exist "venv" (
    echo Creating Python virtual environment...
    python -m venv venv
)

REM Activate virtual environment and install dependencies
echo Installing Python dependencies...
call venv\Scripts\activate
pip install -r requirements.txt

echo  Starting backend server...
start "Backend Server" cmd /k "venv\Scripts\activate && python src/main.py"

cd ..

REM Setup and start frontend
echo.
echo  Setting up React frontend...
cd frontend

REM Install dependencies if node_modules doesn't exist
if not exist "node_modules" (
    echo Installing Node.js dependencies...
    npm install
)

echo  Starting frontend development server...
start "Frontend Server" cmd /k "npm run dev"

cd ..

echo.
echo  AOP Network Visualizer is starting up!
echo.
echo  Frontend: http://localhost:5173
echo  Backend:  http://localhost:5001
echo.
echo  Close the terminal windows to stop the servers
echo.
pause
