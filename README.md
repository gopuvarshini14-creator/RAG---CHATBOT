# DocMind - RAG Document Q&A

Upload documents. Ask questions. Get AI-powered answers with source citations.

## Quick Start

### Linux/macOS
```bash
chmod +x start.sh && ./start.sh
```

### Windows
```
Double-click start.bat
```

### Manual
```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # <-- Add OPENAI_API_KEY here
uvicorn main:app --reload

# Frontend (new terminal)
cd frontend && npm install && npm run dev
# Open http://localhost:3000
```

### Docker
```bash
export OPENAI_API_KEY=sk-...
docker-compose up --build
```

## Features
- PDF, DOCX, TXT upload (drag-and-drop)
- Semantic search with ChromaDB
- Multi-turn chat with source citations
- Streaming responses (SSE)
- Document summarization (3 modes)
- Dark mode + keyboard shortcuts
- Auth + rate limiting
- Export chat as MD/JSON/TXT
- Full test suite + CI/CD

## Deploy
- Backend: Render.com (see render.yaml)
- Frontend: Vercel (see frontend/vercel.json)
- Both: Docker Compose

See docs/DEPLOYMENT.md for full instructions.
