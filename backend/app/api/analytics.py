"""
Analytics API Router
Provides statistics about documents, queries, and system health.
Useful for monitoring production usage.
"""

import logging
from fastapi import APIRouter
from datetime import datetime, timedelta
from typing import Optional

from app.api.documents import load_metadata
from app.models.schemas import DocumentStatus

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/stats")
async def get_stats():
    """
    System-wide statistics.
    Returns document counts, chunk totals, and storage usage.
    """
    all_meta = load_metadata()
    docs = list(all_meta.values())

    ready = [d for d in docs if d.get("status") == DocumentStatus.READY]
    processing = [d for d in docs if d.get("status") == DocumentStatus.PROCESSING]
    errored = [d for d in docs if d.get("status") == DocumentStatus.ERROR]

    total_chunks = sum(d.get("chunk_count", 0) for d in ready)
    total_size_bytes = sum(d.get("file_size", 0) for d in docs)

    # File type breakdown
    type_counts: dict[str, int] = {}
    for doc in docs:
        ft = doc.get("file_type", "unknown")
        type_counts[ft] = type_counts.get(ft, 0) + 1

    return {
        "documents": {
            "total": len(docs),
            "ready": len(ready),
            "processing": len(processing),
            "errored": len(errored),
            "by_type": type_counts,
        },
        "chunks": {
            "total": total_chunks,
            "avg_per_document": round(total_chunks / len(ready), 1) if ready else 0,
        },
        "storage": {
            "total_bytes": total_size_bytes,
            "total_mb": round(total_size_bytes / (1024 ** 2), 2),
        },
        "system": {
            "timestamp": datetime.now().isoformat(),
            "uptime": "n/a",  # Track with startup time in production
        }
    }


@router.get("/documents/{doc_id}/info")
async def get_document_info(doc_id: str):
    """
    Detailed info about a specific document including chunk distribution.
    """
    all_meta = load_metadata()
    if doc_id not in all_meta:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Document not found")

    doc = all_meta[doc_id]

    from app.services.vector_store import VectorStoreService
    vector_service = VectorStoreService()
    chunks = await vector_service.get_document_chunks(doc_id)

    # Analyze chunk length distribution
    chunk_lengths = [len(c["text"]) for c in chunks]
    avg_chunk_len = sum(chunk_lengths) / len(chunk_lengths) if chunk_lengths else 0

    return {
        **doc,
        "chunk_stats": {
            "count": len(chunks),
            "avg_chars": round(avg_chunk_len),
            "min_chars": min(chunk_lengths) if chunk_lengths else 0,
            "max_chars": max(chunk_lengths) if chunk_lengths else 0,
        }
    }
