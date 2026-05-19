"""Health check endpoint"""
from fastapi import APIRouter
from datetime import datetime

router = APIRouter()

@router.get("/health")
async def health_check():
    return {"status": "ok", "timestamp": datetime.now().isoformat(), "service": "RAG API"}
