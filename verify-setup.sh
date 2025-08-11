#!/bin/bash

# AOP Network Visualizer - Setup Verification

echo "🔧 AOP Network Visualizer Setup Verification"
echo "=============================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to print status
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN} $2${NC}"
    else
        echo -e "${RED} $2${NC}"
    fi
}

echo "📋 Checking System Requirements..."
echo ""

# Check Node.js
if command_exists node; then
    NODE_VERSION=$(node --version)
    print_status 0 "Node.js installed: $NODE_VERSION"
else
    print_status 1 "Node.js not found - Please install Node.js 16+ from https://nodejs.org/"
fi

# Check Python
if command_exists python3; then
    PYTHON_VERSION=$(python3 --version)
    print_status 0 "Python installed: $PYTHON_VERSION"
elif command_exists python; then
    PYTHON_VERSION=$(python --version)
    print_status 0 "Python installed: $PYTHON_VERSION"
else
    print_status 1 "Python not found - Please install Python 3.8+ from https://python.org/"
fi

# Check npm
if command_exists npm; then
    NPM_VERSION=$(npm --version)
    print_status 0 "npm installed: v$NPM_VERSION"
else
    print_status 1 "npm not found - Usually comes with Node.js"
fi

echo ""
echo " Checking Project Structure..."
echo ""

# Check directories
[ -d "frontend" ] && print_status 0 "Frontend directory exists" || print_status 1 "Frontend directory missing"
[ -d "backend" ] && print_status 0 "Backend directory exists" || print_status 1 "Backend directory missing"
[ -d "data" ] && print_status 0 "Data directory exists" || print_status 1 "Data directory missing"

# Check key files
[ -f "frontend/package.json" ] && print_status 0 "Frontend package.json exists" || print_status 1 "Frontend package.json missing"
[ -f "backend/requirements.txt" ] && print_status 0 "Backend requirements.txt exists" || print_status 1 "Backend requirements.txt missing"
[ -f "backend/src/main.py" ] && print_status 0 "Backend main.py exists" || print_status 1 "Backend main.py missing"

# Check data files
[ -f "data/aop_ke_ec.tsv" ] && print_status 0 "Data file aop_ke_ec.tsv exists" || print_status 1 "Data file aop_ke_ec.tsv missing"
[ -f "data/aop_ke_ker.tsv" ] && print_status 0 "Data file aop_ke_ker.tsv exists" || print_status 1 "Data file aop_ke_ker.tsv missing"
[ -f "data/aop_ke_mie_ao.tsv" ] && print_status 0 "Data file aop_ke_mie_ao.tsv exists" || print_status 1 "Data file aop_ke_mie_ao.tsv missing"

echo ""
echo "🔗 Checking Dependencies..."
echo ""

# Check if npm packages are installed
if [ -d "frontend/node_modules" ]; then
    print_status 0 "Frontend dependencies installed"
else
    print_status 1 "Frontend dependencies not installed - Run 'npm install' in frontend directory"
fi

# Check if Python virtual environment exists
if [ -d "backend/venv" ]; then
    print_status 0 "Python virtual environment exists"
else
    echo -e "${YELLOW}  Python virtual environment not found - Will be created on first run${NC}"
fi

echo ""
echo " Ready to Start!"
echo ""
echo "To start the application:"
echo "• On Linux/Mac: ./start.sh"
echo "• On Windows: start.bat"
echo "• Manual: Follow the README.md installation steps"
echo ""
