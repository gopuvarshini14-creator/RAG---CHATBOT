#!/bin/bash
# ============================================================
# RAG App — Quick Start Script
# Usage: chmod +x start.sh && ./start.sh
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${BLUE}╔══════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     DocMind RAG App — Quick Start    ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════╝${NC}"
echo ""

# ── Check prerequisites ───────────────────────────────────────
echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! command -v python3 &>/dev/null; then
  echo -e "${RED}✗ Python 3 not found. Install from https://python.org${NC}"; exit 1
fi

PYTHON_VER=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
echo -e "${GREEN}✓ Python ${PYTHON_VER}${NC}"

if ! command -v node &>/dev/null; then
  echo -e "${RED}✗ Node.js not found. Install from https://nodejs.org${NC}"; exit 1
fi

NODE_VER=$(node --version)
echo -e "${GREEN}✓ Node ${NODE_VER}${NC}"

# ── Backend setup ─────────────────────────────────────────────
echo ""
echo -e "${YELLOW}Setting up backend...${NC}"
cd backend

# Create virtualenv if not exists
if [ ! -d "venv" ]; then
  echo "Creating virtual environment..."
  python3 -m venv venv
fi

# Activate
source venv/bin/activate 2>/dev/null || source venv/Scripts/activate 2>/dev/null

# Install deps
echo "Installing Python dependencies..."
pip install -r requirements.txt -q

# Create .env if not exists
if [ ! -f ".env" ]; then
  cp .env.example .env
  echo ""
  echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${RED}  ACTION REQUIRED: Add your OpenAI key   ${NC}"
  echo -e "${RED}  Edit backend/.env and set:             ${NC}"
  echo -e "${RED}  OPENAI_API_KEY=sk-your-key-here        ${NC}"
  echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  read -p "Press Enter after adding your API key..."
fi

# Verify API key is set
if grep -q "sk-your-openai-api-key-here" .env; then
  echo -e "${RED}✗ OpenAI API key not set in backend/.env${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Backend configured${NC}"
cd ..

# ── Frontend setup ────────────────────────────────────────────
echo ""
echo -e "${YELLOW}Setting up frontend...${NC}"
cd frontend

if [ ! -d "node_modules" ]; then
  echo "Installing Node.js dependencies..."
  npm install --silent
fi

echo -e "${GREEN}✓ Frontend configured${NC}"
cd ..

# ── Start both servers ────────────────────────────────────────
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Starting DocMind RAG Application...   ${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  ${BLUE}Backend API:${NC}  http://localhost:8000"
echo -e "  ${BLUE}Frontend:    ${NC}  http://localhost:3000"
echo -e "  ${BLUE}API Docs:    ${NC}  http://localhost:8000/docs"
echo ""
echo -e "  Press ${RED}Ctrl+C${NC} to stop both servers"
echo ""

# Start backend
(
  cd backend
  source venv/bin/activate 2>/dev/null || source venv/Scripts/activate 2>/dev/null
  uvicorn main:app --reload --port 8000 --log-level warning
) &
BACKEND_PID=$!

# Wait for backend to be ready
sleep 3

# Start frontend
(
  cd frontend
  npm run dev -- --port 3000
) &
FRONTEND_PID=$!

# Open browser (optional)
sleep 3
if command -v open &>/dev/null; then
  open http://localhost:3000
elif command -v xdg-open &>/dev/null; then
  xdg-open http://localhost:3000
fi

# Wait and handle Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo ''; echo 'Stopped.'; exit 0" SIGINT SIGTERM
wait
