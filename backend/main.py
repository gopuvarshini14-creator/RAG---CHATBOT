"""
RAG Application — main.py (Production-Ready Version)
Includes: rate limiting, request logging, auth, CORS, gzip
"""

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from contextlib import asynccontextmanager
import logging
import logging.config

from app.api import documents, chat, health
from app.core.config import settings
from app.core.database import init_vector_store
from app.middleware.rate_limit import RateLimitMiddleware
from app.middleware.logging import RequestLoggingMiddleware

# ─── Logging Configuration ────────────────────────────────────
LOGGING_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "standard": {
            "format": "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
            "datefmt": "%Y-%m-%d %H:%M:%S",
        },
        "json": {
            # Use python-json-logger in production for structured logs
            "format": "%(asctime)s %(levelname)s %(name)s %(message)s",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "standard",
            "stream": "ext://sys.stdout",
        },
    },
    "root": {"level": "INFO", "handlers": ["console"]},
    "loggers": {
        "uvicorn": {"level": "WARNING"},
        "httpx": {"level": "WARNING"},
        "chromadb": {"level": "WARNING"},
    },
}
logging.config.dictConfig(LOGGING_CONFIG)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle"""
    logger.info("=" * 50)
    logger.info(f"Starting {settings.APP_NAME}")
    logger.info(f"Vector store: {settings.VECTOR_STORE_TYPE}")
    logger.info(f"LLM model: {settings.OPENAI_MODEL}")
    logger.info(f"Auth enabled: {settings.ENABLE_AUTH}")
    logger.info(f"Debug mode: {settings.DEBUG}")
    logger.info("=" * 50)

    await init_vector_store()
    logger.info("✅ Vector store ready")
    yield

    logger.info("Shutting down gracefully...")


# ─── App Factory ─────────────────────────────────────────────
app = FastAPI(
    title="RAG Document Q&A API",
    description="""
## RAG-powered Document Q&A

Upload documents and ask questions. The API uses:
- **ChromaDB** for vector storage
- **OpenAI Embeddings** for semantic search
- **GPT-4o-mini** for answer generation

### Authentication
When `ENABLE_AUTH=true`, use HTTP Basic Auth or `X-API-Key` header.

### Rate Limits
- Chat endpoints: 20 req/min per IP
- Upload: 10 req/min per IP
- Other: 100 req/min per IP
    """,
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
redoc_url="/redoc",
    
)

# ─── Middleware Stack (order matters!) ────────────────────────
# 1. Request logging (outermost — captures everything)
app.add_middleware(RequestLoggingMiddleware)

# 2. Rate limiting
if not settings.DEBUG:
    app.add_middleware(RateLimitMiddleware)

# 3. CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# 4. Gzip compression (innermost)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# ─── Routers ─────────────────────────────────────────────────
app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(documents.router, prefix="/api/documents", tags=["documents"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])


# ─── Global Exception Handler ────────────────────────────────
from fastapi import Request
from fastapi.responses import JSONResponse

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception on {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error. Please try again."},
    )


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        log_config=None,  # Use our custom logging config
        access_log=False,  # Our middleware handles this
    )

    
