# Makefile — Common development tasks
# Usage: make <target>

.PHONY: help install dev test lint clean docker-up docker-down

# Default: show help
help:
	@echo "RAG Application — Available Commands"
	@echo "====================================="
	@echo "  make install      Install all dependencies"
	@echo "  make dev          Start backend + frontend in dev mode"
	@echo "  make test         Run all tests"
	@echo "  make lint         Run linters"
	@echo "  make clean        Remove generated files"
	@echo "  make docker-up    Start with Docker Compose"
	@echo "  make docker-down  Stop Docker Compose"
	@echo "  make setup        First-time setup (install + copy .env)"

# ─── Setup ────────────────────────────────────────────────────
setup: install
	@if [ ! -f backend/.env ]; then \
		cp backend/.env.example backend/.env; \
		echo "✅ Created backend/.env — add your OPENAI_API_KEY"; \
	fi
	@if [ ! -f frontend/.env.local ]; then \
		cp frontend/.env.example frontend/.env.local; \
		echo "✅ Created frontend/.env.local"; \
	fi

install:
	@echo "Installing backend dependencies..."
	cd backend && python -m pip install -r requirements.txt
	@echo "Installing frontend dependencies..."
	cd frontend && npm install
	@echo "✅ All dependencies installed"

# ─── Development ──────────────────────────────────────────────
dev:
	@echo "Starting backend and frontend..."
	@trap 'kill %1 %2' SIGINT; \
	(cd backend && uvicorn main:app --reload --port 8000) & \
	(cd frontend && npm run dev) & \
	wait

dev-backend:
	cd backend && uvicorn main:app --reload --port 8000

dev-frontend:
	cd frontend && npm run dev

# ─── Testing ──────────────────────────────────────────────────
test:
	@echo "Running backend tests..."
	cd backend && pytest app/tests/ -v
	@echo "✅ Backend tests passed"

test-cov:
	cd backend && pytest app/tests/ -v --cov=app --cov-report=html
	@echo "Coverage report: backend/htmlcov/index.html"

# ─── Linting ──────────────────────────────────────────────────
lint:
	@echo "Linting backend..."
	cd backend && python -m ruff check app/ main.py || true
	@echo "Linting frontend..."
	cd frontend && npm run lint || true

format:
	cd backend && python -m ruff format app/ main.py

# ─── Docker ───────────────────────────────────────────────────
docker-up:
	docker-compose up --build

docker-down:
	docker-compose down

docker-logs:
	docker-compose logs -f

# ─── Cleanup ──────────────────────────────────────────────────
clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
	find . -name "*.pyc" -delete 2>/dev/null || true
	rm -rf backend/htmlcov backend/.coverage 2>/dev/null || true
	rm -rf frontend/dist frontend/node_modules/.cache 2>/dev/null || true
	@echo "✅ Cleaned up generated files"

# ─── Database ─────────────────────────────────────────────────
reset-db:
	@echo "⚠️  Resetting vector store and uploads..."
	@read -p "Are you sure? [y/N] " confirm && [ "$$confirm" = "y" ] || exit 1
	rm -rf backend/chroma_db backend/faiss_index* backend/uploads/
	mkdir -p backend/uploads backend/chroma_db
	@echo "✅ Database reset complete"
