"""
Documents API Router
Handles file upload, processing, listing, deletion, and summarization.
"""

import os
import uuid
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks, Depends
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.models.schemas import (
    DocumentListResponse, DocumentMetadata, DocumentStatus,
    SummaryRequest, SummaryResponse, DeleteResponse
)
from app.services.parser import DocumentParser
from app.services.chunker import TextChunker
from app.services.vector_store import VectorStoreService
from app.services.llm import LLMService

logger = logging.getLogger(__name__)
router = APIRouter()

# Simple JSON file-based metadata store
# In production, replace with PostgreSQL or Redis
METADATA_FILE = "./uploads/documents_meta.json"


def load_metadata() -> dict:
    """Load document metadata from JSON store"""
    if os.path.exists(METADATA_FILE):
        with open(METADATA_FILE, "r") as f:
            return json.load(f)
    return {}


def save_metadata(meta: dict):
    """Persist document metadata to JSON store"""
    os.makedirs(os.path.dirname(METADATA_FILE), exist_ok=True)
    with open(METADATA_FILE, "w") as f:
        json.dump(meta, f, indent=2, default=str)


@router.post("/upload", response_model=DocumentMetadata)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    """
    Upload a document (PDF, DOCX, TXT).
    Text extraction and embedding happen in the background.
    Returns immediately with document metadata.
    """
    # Validate file type
    ext = Path(file.filename).suffix.lower().strip(".")
    if ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type '.{ext}' not supported. Allowed: {settings.ALLOWED_EXTENSIONS}"
        )

    # Validate file size
    content = await file.read()
    file_size = len(content)
    max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    if file_size > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Max size: {settings.MAX_FILE_SIZE_MB}MB"
        )

    # Generate unique document ID
    doc_id = str(uuid.uuid4())
    safe_filename = f"{doc_id}_{file.filename}"
    file_path = os.path.join(settings.UPLOAD_DIR, safe_filename)

    # Save file to disk
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    with open(file_path, "wb") as f:
        f.write(content)

    # Create metadata entry (status = processing until done)
    meta = {
        "doc_id": doc_id,
        "filename": file.filename,
        "file_type": ext,
        "file_size": file_size,
        "file_path": file_path,
        "chunk_count": 0,
        "uploaded_at": datetime.now().isoformat(),
        "status": DocumentStatus.PROCESSING,
    }

    # Save metadata
    all_meta = load_metadata()
    all_meta[doc_id] = meta
    save_metadata(all_meta)

    # Process document in background (don't block the response)
    background_tasks.add_task(process_document, doc_id, file_path, file.filename, ext)

    return DocumentMetadata(**meta)


async def process_document(doc_id: str, file_path: str, filename: str, file_type: str):
    """
    Background task: parse → chunk → embed → store.
    This is the core RAG pipeline for document ingestion.
    """
    logger.info(f"Processing document: {filename} ({doc_id})")
    all_meta = load_metadata()

    try:
        # Step 1: Extract text from file
        parser = DocumentParser()
        text, doc_meta = parser.extract_text(file_path, file_type)

        if not text.strip():
            raise ValueError("No text could be extracted from the document")

        # Step 2: Split text into chunks
        chunker = TextChunker()
        chunks = chunker.split_text(text, doc_id, filename)

        if not chunks:
            raise ValueError("Document produced no processable chunks")

        # Step 3: Generate embeddings and store in vector DB
        vector_service = VectorStoreService()
        stored_count = await vector_service.add_chunks(chunks)

        # Update metadata with success
        all_meta[doc_id].update({
            "chunk_count": stored_count,
            "status": DocumentStatus.READY,
            "page_count": doc_meta.get("page_count"),
        })

        logger.info(f"Successfully processed '{filename}': {stored_count} chunks stored")

    except Exception as e:
        logger.error(f"Error processing document {doc_id}: {e}", exc_info=True)
        if doc_id in all_meta:
            all_meta[doc_id]["status"] = DocumentStatus.ERROR
            all_meta[doc_id]["error"] = str(e)

    save_metadata(all_meta)


@router.get("/", response_model=DocumentListResponse)
async def list_documents():
    """List all uploaded documents with their status"""
    all_meta = load_metadata()
    docs = [DocumentMetadata(**v) for v in all_meta.values()]
    # Sort by upload time (newest first)
    docs.sort(key=lambda d: d.uploaded_at, reverse=True)
    return DocumentListResponse(documents=docs, total=len(docs))


@router.get("/{doc_id}", response_model=DocumentMetadata)
async def get_document(doc_id: str):
    """Get metadata for a specific document"""
    all_meta = load_metadata()
    if doc_id not in all_meta:
        raise HTTPException(status_code=404, detail="Document not found")
    return DocumentMetadata(**all_meta[doc_id])


@router.delete("/{doc_id}", response_model=DeleteResponse)
async def delete_document(doc_id: str):
    """Delete a document and all its chunks from the vector store"""
    all_meta = load_metadata()
    if doc_id not in all_meta:
        raise HTTPException(status_code=404, detail="Document not found")

    doc_info = all_meta[doc_id]

    # Remove chunks from vector store
    vector_service = VectorStoreService()
    deleted_chunks = await vector_service.delete_document(doc_id)

    # Remove file from disk
    if os.path.exists(doc_info.get("file_path", "")):
        os.remove(doc_info["file_path"])

    # Remove from metadata
    del all_meta[doc_id]
    save_metadata(all_meta)

    return DeleteResponse(
        success=True,
        message=f"Deleted document '{doc_info['filename']}' and {deleted_chunks} chunks"
    )


@router.post("/summarize", response_model=SummaryResponse)
async def summarize_document(request: SummaryRequest):
    """
    Summarize an entire document or a specific section of text.
    Useful for getting a quick overview without asking specific questions.
    """
    all_meta = load_metadata()
    if request.doc_id not in all_meta:
        raise HTTPException(status_code=404, detail="Document not found")

    doc_info = all_meta[request.doc_id]

    if doc_info["status"] != DocumentStatus.READY:
        raise HTTPException(
            status_code=400,
            detail="Document is still processing. Please wait."
        )

    llm_service = LLMService()

    if request.section_text:
        # Summarize user-provided text section
        text_to_summarize = request.section_text
    else:
        # Summarize full document by retrieving all chunks
        vector_service = VectorStoreService()
        chunks = await vector_service.get_document_chunks(request.doc_id)

        if not chunks:
            raise HTTPException(status_code=404, detail="No chunks found for this document")

        # Reassemble document text from chunks (in order)
        text_to_summarize = "\n\n".join(chunk["text"] for chunk in chunks)

    summary, tokens = await llm_service.summarize(
        text=text_to_summarize,
        summary_type=request.summary_type,
        filename=doc_info["filename"],
    )

    return SummaryResponse(
        summary=summary,
        doc_id=request.doc_id,
        tokens_used=tokens,
    )
