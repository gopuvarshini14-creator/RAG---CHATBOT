"""
Configuration Settings — Extended Version
Adds API key list, rate limiting toggles, and more tunables.
"""

from pydantic_settings import BaseSettings
from typing import List, Optional
import os


class Settings(BaseSettings):
    # ─── App ─────────────────────────────────────────────────
    APP_NAME: str = "RAG Document Q&A"
    DEBUG: bool = False
    SECRET_KEY: str = "CHANGE-ME-IN-PRODUCTION-USE-A-LONG-RANDOM-STRING"
    ENVIRONMENT: str = "development"  # "development" | "staging" | "production"

    # ─── OpenAI ──────────────────────────────────────────────
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    OPENAI_EMBED_MODEL: str = "text-embedding-3-small"
    OPENAI_MAX_RETRIES: int = 3          # Auto-retry on rate limit
    OPENAI_TIMEOUT: float = 60.0         # Request timeout in seconds

    # ─── Vector Store ─────────────────────────────────────────
    VECTOR_STORE_TYPE: str = "chroma"
    CHROMA_PERSIST_DIR: str = "./chroma_db"
    FAISS_INDEX_PATH: str = "./faiss_index"

    # ─── RAG Tuning ──────────────────────────────────────────
    CHUNK_SIZE: int = 800
    CHUNK_OVERLAP: int = 150
    TOP_K_RESULTS: int = 5
    SIMILARITY_THRESHOLD: float = 0.0
    MAX_CONTEXT_TOKENS: int = 12000      # Max tokens to send as context to LLM
    MAX_HISTORY_TURNS: int = 6           # Chat turns kept in context

    # ─── File Upload ─────────────────────────────────────────
    UPLOAD_DIR: str = "./uploads"
    MAX_FILE_SIZE_MB: int = 50
    ALLOWED_EXTENSIONS: List[str] = ["pdf", "docx", "txt"]

    # ─── Auth ────────────────────────────────────────────────
    ENABLE_AUTH: bool = False
    AUTH_USERNAME: str = "admin"
    AUTH_PASSWORD: str = "changeme"       # Change this!
    API_KEYS: List[str] = []              # Accepted X-API-Key values

    # ─── CORS ────────────────────────────────────────────────
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
    ]

    # ─── Rate Limiting ───────────────────────────────────────
    ENABLE_RATE_LIMITING: bool = True
    RATE_LIMIT_CHAT: int = 20            # req/min for chat endpoints
    RATE_LIMIT_UPLOAD: int = 10          # req/min for upload
    RATE_LIMIT_DEFAULT: int = 100        # req/min for everything else

    # ─── Summarization ───────────────────────────────────────
    SUMMARY_MAX_CHARS: int = 80000       # Truncate docs longer than this
    SUMMARY_MAX_TOKENS: int = 2000       # Max tokens in summary output

    class Config:
        env_file = ".env"
        case_sensitive = True

    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"


settings = Settings()

# Ensure required directories exist
for d in [settings.UPLOAD_DIR, settings.CHROMA_PERSIST_DIR]:
    os.makedirs(d, exist_ok=True)

# Validate critical settings in production
if settings.is_production():
    assert settings.OPENAI_API_KEY, "OPENAI_API_KEY must be set in production"
    assert settings.SECRET_KEY != "CHANGE-ME-IN-PRODUCTION-USE-A-LONG-RANDOM-STRING", \
        "Change SECRET_KEY in production!"
