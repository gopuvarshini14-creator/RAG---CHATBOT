"""
Vector Database Management
Supports ChromaDB (recommended) and FAISS
"""

import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

# Global vector store instance
_vector_store = None


async def init_vector_store():
    """Initialize the vector store on application startup"""
    global _vector_store
    if settings.VECTOR_STORE_TYPE == "chroma":
        _vector_store = await _init_chroma()
    elif settings.VECTOR_STORE_TYPE == "faiss":
        _vector_store = await _init_faiss()
    else:
        raise ValueError(f"Unknown vector store type: {settings.VECTOR_STORE_TYPE}")
    logger.info(f"Vector store ({settings.VECTOR_STORE_TYPE}) ready.")
    return _vector_store


async def _init_chroma():
    """Initialize ChromaDB - persistent, no server needed"""
    import chromadb
    from chromadb.config import Settings as ChromaSettings

    client = chromadb.PersistentClient(
        path=settings.CHROMA_PERSIST_DIR,
        settings=ChromaSettings(anonymized_telemetry=False)
    )
    return client


async def _init_faiss():
    """Initialize FAISS - fast in-memory with disk persistence"""
    # FAISS index is created per-collection in the service layer
    return {"type": "faiss"}


def get_vector_store():
    """Dependency injection helper to get vector store"""
    if _vector_store is None:
        raise RuntimeError("Vector store not initialized. Call init_vector_store() first.")
    return _vector_store
