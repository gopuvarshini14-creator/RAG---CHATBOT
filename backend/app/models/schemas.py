"""
Data Models
Pydantic schemas for API requests and responses
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum


class DocumentStatus(str, Enum):
    PROCESSING = "processing"
    READY = "ready"
    ERROR = "error"


class DocumentMetadata(BaseModel):
    """Metadata stored alongside each document"""
    doc_id: str
    filename: str
    file_type: str
    file_size: int
    chunk_count: int
    uploaded_at: datetime
    status: DocumentStatus = DocumentStatus.READY


class DocumentListResponse(BaseModel):
    """List of uploaded documents"""
    documents: List[DocumentMetadata]
    total: int


class ChunkSource(BaseModel):
    """A retrieved chunk used as context for answering"""
    doc_id: str
    filename: str
    chunk_index: int
    content: str          # The actual text chunk
    score: float          # Similarity score (0-1, higher = more relevant)
    page_number: Optional[int] = None


class ChatMessage(BaseModel):
    """A single message in the chat history"""
    role: str             # "user" or "assistant"
    content: str
    timestamp: datetime = Field(default_factory=datetime.now)
    sources: Optional[List[ChunkSource]] = None


class ChatRequest(BaseModel):
    """User's question + context"""
    question: str = Field(..., min_length=1, max_length=2000)
    doc_ids: Optional[List[str]] = None   # Filter to specific docs (None = all)
    chat_history: Optional[List[Dict[str, str]]] = []
    stream: bool = False


class ChatResponse(BaseModel):
    """LLM answer with source attribution"""
    answer: str
    sources: List[ChunkSource]
    doc_ids_searched: List[str]
    tokens_used: Optional[int] = None


class SummaryRequest(BaseModel):
    """Request to summarize a document or section"""
    doc_id: str
    section_text: Optional[str] = None   # If None, summarize full document
    summary_type: str = "concise"        # "concise", "detailed", "bullets"


class SummaryResponse(BaseModel):
    """Generated summary"""
    summary: str
    doc_id: str
    tokens_used: Optional[int] = None


class DeleteResponse(BaseModel):
    success: bool
    message: str
