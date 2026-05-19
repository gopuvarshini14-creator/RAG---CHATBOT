# 🚀 RAG Application — Complete Deployment Guide

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    RAG System Flow                       │
│                                                         │
│  📄 Upload Doc ──► Parser ──► Chunker ──► Embeddings   │
│                                               │         │
│                                          ChromaDB       │
│                                               │         │
│  ❓ User Question ──► Embed Query ──► Similarity Search │
│                                               │         │
│                           Top-K Chunks ──► GPT-4 LLM   │
│                                               │         │
│                                         ✅ Answer +     │
│                                            Sources      │
└─────────────────────────────────────────────────────────┘
```

**Stack:**
- **Frontend:** React + Vite + TailwindCSS (Vercel)
- **Backend:** FastAPI + Python (Render / Railway)
- **Embeddings:** OpenAI text-embedding-3-small
- **LLM:** OpenAI GPT-4o-mini
- **Vector DB:** ChromaDB (persistent local)
- **File Parsing:** PyMuPDF + python-docx

---

## 📦 Project Structure

```
rag-app/
├── backend/
│   ├── main.py                    # FastAPI entry point
│   ├── requirements.txt           # Python dependencies
│   ├── Dockerfile
│   ├── .env.example               # Copy to .env
│   └── app/
│       ├── api/
│       │   ├── chat.py            # /api/chat/* endpoints
│       │   ├── documents.py       # /api/documents/* endpoints
│       │   └── health.py
│       ├── core/
│       │   ├── config.py          # All settings via env vars
│       │   └── database.py        # Vector store init
│       ├── models/
│       │   └── schemas.py         # Pydantic models
│       └── services/
│           ├── parser.py          # PDF/DOCX/TXT extraction
│           ├── chunker.py         # Text splitting
│           ├── embeddings.py      # OpenAI embeddings
│           ├── vector_store.py    # ChromaDB / FAISS
│           └── llm.py             # GPT answer generation
└── frontend/
    ├── src/
    │   ├── App.jsx                # Root layout
    │   ├── components/
    │   │   ├── FileUploader.jsx   # Drag-drop upload
    │   │   ├── DocumentList.jsx   # Sidebar doc list
    │   │   ├── ChatWindow.jsx     # Main chat interface
    │   │   ├── ChatMessage.jsx    # Message + sources
    │   │   └── SummaryPanel.jsx   # Document summarizer
    │   ├── services/api.js        # Axios + streaming API
    │   └── store/useStore.js      # Zustand global state
    ├── package.json
    └── Dockerfile
```

---

## 🖥️ Local Development (Quickstart)

### Prerequisites
- Python 3.10+
- Node.js 18+
- OpenAI API Key (https://platform.openai.com)

### Step 1 — Backend Setup

```bash
cd rag-app/backend

# Create virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY

# Start backend
uvicorn main:app --reload --port 8000
# API docs at: http://localhost:8000/docs
```

### Step 2 — Frontend Setup

```bash
cd rag-app/frontend

# Install dependencies
npm install

# Start dev server (proxies /api to localhost:8000)
npm run dev
# Open: http://localhost:3000
```

### Step 3 — Test the App

1. Open http://localhost:3000
2. Upload a PDF, DOCX, or TXT file
3. Wait for "Ready" status (processing takes 10-60 seconds)
4. Ask questions in the chat!

---

## 🐳 Docker (All-in-One)

```bash
# From rag-app/ root
export OPENAI_API_KEY=

docker-compose up --build

# Frontend: http://localhost:3000
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

---

## ☁️ Production Deployment

### Backend → Render (Free Tier Available)

1. Push code to GitHub
2. Go to https://render.com → New → Web Service
3. Connect your repository
4. Configure:
   ```
   Root Directory: backend
   Runtime: Python 3
   Build Command: pip install -r requirements.txt
   Start Command: uvicorn main:app --host 0.0.0.0 --port $PORT
   ```
5. Add Environment Variables:
   ```
   OPENAI_API_KEY=sk-your-key
   ALLOWED_ORIGINS=["https://your-frontend.vercel.app"]
   VECTOR_STORE_TYPE=chroma
   ```
6. Add a Persistent Disk (required for ChromaDB):
   - Mount path: `/app/chroma_db`
   - Size: 1GB (free)

### Backend → Railway

```bash
# Install Railway CLI
npm install -g @railway/cli
railway login

cd backend
railway init
railway up

# Set environment variables
railway variables set OPENAI_API_KEY=sk-your-key
railway variables set VECTOR_STORE_TYPE=chroma
```

### Frontend → Vercel (Recommended)

```bash
# Install Vercel CLI
npm install -g vercel

cd frontend

# Create .env.local with your backend URL
echo "VITE_API_URL=https://your-backend.onrender.com/api" > .env.local

# Deploy
vercel --prod
```

Or via Vercel dashboard:
1. Import GitHub repo
2. Set root directory: `frontend`
3. Add environment variable: `VITE_API_URL=https://your-backend-url/api`
4. Deploy!

### Frontend → Netlify

```bash
cd frontend
npm run build

# Deploy dist/ folder to Netlify
# Or connect GitHub and set:
# Build command: npm run build
# Publish directory: dist
# Environment variable: VITE_API_URL=https://your-backend-url/api
```

---

## 🔑 Environment Variables Reference

### Backend (.env)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | ✅ Yes | - | Your OpenAI API key |
| `OPENAI_MODEL` | No | `gpt-4o-mini` | LLM model for answers |
| `OPENAI_EMBED_MODEL` | No | `text-embedding-3-small` | Embedding model |
| `VECTOR_STORE_TYPE` | No | `chroma` | `chroma` or `faiss` |
| `CHUNK_SIZE` | No | `800` | Characters per chunk |
| `CHUNK_OVERLAP` | No | `150` | Overlap between chunks |
| `TOP_K_RESULTS` | No | `5` | Chunks retrieved per query |
| `MAX_FILE_SIZE_MB` | No | `50` | Max upload size |
| `ALLOWED_ORIGINS` | No | localhost | CORS origins (JSON array) |
| `DEBUG` | No | `false` | Enable debug mode |

### Frontend (.env.local)

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend URL (e.g., `https://api.myapp.com/api`) |

---

## 🧪 API Reference

### Upload Document
```http
POST /api/documents/upload
Content-Type: multipart/form-data

file: <file>
```

### Ask Question
```http
POST /api/chat/ask
Content-Type: application/json

{
  "question": "What are the main findings?",
  "doc_ids": ["uuid1", "uuid2"],  // optional, null = all docs
  "chat_history": [               // optional, for multi-turn
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "..."}
  ]
}
```

### Stream Answer
```http
POST /api/chat/ask/stream
Content-Type: application/json
// Same body as /ask
// Returns Server-Sent Events
```

### Summarize Document
```http
POST /api/documents/summarize
Content-Type: application/json

{
  "doc_id": "uuid",
  "summary_type": "concise",  // "concise" | "detailed" | "bullets"
  "section_text": null        // optional: summarize specific text
}
```

---

## ⚡ Performance Tuning

### Chunk Size
- **Small chunks (400-600 chars):** More precise retrieval, less context
- **Large chunks (800-1200 chars):** More context, less precise
- **Default (800):** Good balance for most documents

### Top-K Results
- Increase `TOP_K_RESULTS` for complex questions needing more context
- Decrease for faster responses and lower token usage

### Using Open-Source Embeddings (No OpenAI Cost)
```python
# In app/services/embeddings.py, uncomment SentenceTransformerEmbedding
# And in vector_store.py, change EmbeddingService to SentenceTransformerEmbedding
# Install: pip install sentence-transformers
```

### Using Open-Source LLM (Ollama)
```python
# In app/services/llm.py, replace OpenAI client with:
from openai import AsyncOpenAI
client = AsyncOpenAI(
    base_url="http://localhost:11434/v1",  # Ollama endpoint
    api_key="ollama"
)
# model = "llama3.2" or any Ollama model
```

---

## 🔒 Security Checklist

- [ ] Change `SECRET_KEY` in production
- [ ] Set `ALLOWED_ORIGINS` to your frontend domain only
- [ ] Enable `ENABLE_AUTH=true` and change credentials
- [ ] Use HTTPS in production (Render/Railway/Vercel do this automatically)
- [ ] Store `OPENAI_API_KEY` only in environment variables, never in code
- [ ] Add rate limiting for production (FastAPI-limiter package)

---

## 🐛 Troubleshooting

### "No relevant chunks found"
- Document may still be processing — wait for "ready" status
- Try a more specific question
- Lower `SIMILARITY_THRESHOLD` in config (default 0.3)

### ChromaDB errors after restart
- Ensure `CHROMA_PERSIST_DIR` is on a persistent volume
- In Docker: mount a volume for `/app/chroma_db`

### OpenAI rate limits
- GPT-4o-mini has higher rate limits than GPT-4
- Add retry logic with exponential backoff
- Consider batching embeddings (already implemented)

### Large files slow to process
- PDF parsing with PyMuPDF is fast (~1-5 seconds per 100 pages)
- Embedding generation: ~$0.02 per 1M tokens (very cheap)
- ChromaDB insertion is fast

### CORS errors
- Set `ALLOWED_ORIGINS` to include your frontend URL exactly
- Include both http:// and https:// variants during testing
