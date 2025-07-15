#!/bin/bash

# Safari Extension Unified Logging - Development Setup Script
# This script starts both the frontend and backend in development mode

set -e

echo "🚀 Starting Safari Extension Unified Logging Development Environment"
echo "=================================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if a port is in use
port_in_use() {
    lsof -i :$1 >/dev/null 2>&1
}

# Check prerequisites
echo -e "${BLUE}Checking prerequisites...${NC}"

if ! command_exists python3; then
    echo -e "${RED}❌ Python 3 is required but not installed${NC}"
    exit 1
fi

if ! command_exists npm; then
    echo -e "${RED}❌ Node.js and npm are required but not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}"

# Check if ports are available
if port_in_use 8000; then
    echo -e "${YELLOW}⚠️  Port 8000 is already in use. Backend may not start properly.${NC}"
fi

if port_in_use 5173; then
    echo -e "${YELLOW}⚠️  Port 5173 is already in use. Frontend may not start properly.${NC}"
fi

# Setup backend
echo -e "\n${BLUE}Setting up backend...${NC}"
cd backend

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "Installing Python dependencies..."
pip install -r requirements.txt

# Create logs directory if it doesn't exist
mkdir -p logs

echo -e "${GREEN}✅ Backend setup complete${NC}"

# Setup frontend
echo -e "\n${BLUE}Setting up frontend...${NC}"
cd ../frontend

# Install dependencies
echo "Installing Node.js dependencies..."
npm install

echo -e "${GREEN}✅ Frontend setup complete${NC}"

# Start services
echo -e "\n${BLUE}Starting services...${NC}"

# Start backend in background
echo "Starting backend server..."
cd ../backend
source venv/bin/activate
python run_server.py &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 3

# Start frontend in background
echo "Starting frontend development server..."
cd ../frontend
npm run dev &
FRONTEND_PID=$!

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}Shutting down services...${NC}"
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    echo -e "${GREEN}✅ Services stopped${NC}"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

echo -e "\n${GREEN}🎉 Development environment is ready!${NC}"
echo "=================================================================="
echo -e "${BLUE}Services:${NC}"
echo "  • Backend API: http://localhost:8000"
echo "  • API Docs: http://localhost:8000/docs"
echo "  • Frontend Dev: http://localhost:5173"
echo ""
echo -e "${BLUE}Log Monitoring:${NC}"
echo "  • Unified logs: tail -f logs/unified.log"
echo "  • Backend logs: tail -f backend/logs/unified.log"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"

# Wait for processes
wait