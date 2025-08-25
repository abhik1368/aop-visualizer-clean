#!/bin/bash

# AOP Network Visualizer - Startup Script

echo " Starting AOP Network Visualizer..."
echo ""

# Check if we're on Windows (Git Bash/WSL) or Unix
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
    PYTHON_CMD="python"
    ACTIVATE_CMD="venv\\Scripts\\activate"
else
    PYTHON_CMD="python3"
    ACTIVATE_CMD="source venv/bin/activate"
fi

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check for required dependencies
echo "🔍 Checking dependencies..."

if ! command_exists node; then
    echo " Node.js is not installed. Please install Node.js 16+ from https://nodejs.org/"
    exit 1
fi

if ! command_exists $PYTHON_CMD; then
    echo " Python is not installed. Please install Python 3.8+ from https://python.org/"
    exit 1
fi

if ! command_exists npm; then
    echo " npm is not installed. Please install npm (usually comes with Node.js)"
    exit 1
fi

echo " All dependencies found!"
echo ""

# Setup and start backend
echo " Setting up Python backend..."
cd backend

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    $PYTHON_CMD -m venv venv
fi

# Activate virtual environment and install dependencies
echo "Installing Python dependencies..."
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
    source venv/Scripts/activate
else
    source venv/bin/activate
fi

pip install -r requirements.txt

echo " Starting backend server..."
$PYTHON_CMD src/main.py &
BACKEND_PID=$!

cd ..

# Setup and start frontend
echo ""
echo "  Setting up React frontend..."
cd frontend

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "Installing Node.js dependencies..."
    npm install
fi

echo " Starting frontend development server..."
npm run dev &
FRONTEND_PID=$!

cd ..

echo ""
echo " AOP Network Visualizer is starting up!"
echo ""
echo " Frontend: http://localhost:5173"
echo " Backend:  http://localhost:5001"
echo ""
echo " Press Ctrl+C to stop both servers"
echo ""

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
