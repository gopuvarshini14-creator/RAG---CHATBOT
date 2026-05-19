"""
Chat API Router
Handles Q&A against uploaded documents with optional streaming.
"""

import json
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.models.schemas import ChatRequest, ChatResponse, ChunkSource
from app.services.vector_store import VectorStoreService
from app.services.llm import LLMService
from app.api.documents import load_metadata
from app.models.schemas import DocumentStatus

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/ask", response_model=ChatResponse)
async def ask_question(request: ChatRequest):
    """
    Ask a question about uploaded documents.
    
    Flow:
    1. Embed the question
    2. Retrieve top-K similar chunks from vector store
    3. Pass chunks + question to LLM
    4. Return answer with source citations
    """
    # Validate that requested documents exist and are ready
    all_meta = load_metadata()

    if request.doc_ids:
        for doc_id in request.doc_ids:
            if doc_id not in all_meta:
                raise HTTPException(status_code=404, detail=f"Document {doc_id} not found")
            if all_meta[doc_id]["status"] != DocumentStatus.READY:
                raise HTTPException(
                    status_code=400,
                    detail=f"Document '{all_meta[doc_id]['filename']}' is still processing"
                )

    # Check that we have at least one ready document
    ready_docs = [d for d in all_meta.values() if d["status"] == DocumentStatus.READY]
    if not ready_docs:
        raise HTTPException(
            status_code=400,
            detail="No documents are ready. Please upload and wait for processing."
        )

    # Step 1: Retrieve relevant chunks
    vector_service = VectorStoreService()
    raw_chunks = await vector_service.search(
        query=request.question,
        doc_ids=request.doc_ids,
    )

    if not raw_chunks:
        logger.warning(f"No relevant chunks found for question: {request.question[:50]}...")

    # Step 2: Generate answer from LLM
    llm_service = LLMService()
    answer, tokens = await llm_service.generate_answer(
        question=request.question,
        context_chunks=raw_chunks,
        chat_history=request.chat_history or [],
    )

    # Step 3: Format sources for citation display
    sources = []
    seen_chunks = set()
    for chunk in raw_chunks:
        chunk_id = chunk["id"]
        if chunk_id in seen_chunks:
            continue
        seen_chunks.add(chunk_id)

        meta = chunk.get("metadata", {})
        sources.append(ChunkSource(
            doc_id=meta.get("doc_id", ""),
            filename=meta.get("filename", "Unknown"),
            chunk_index=meta.get("chunk_index", 0),
            content=chunk["text"][:300] + "..." if len(chunk["text"]) > 300 else chunk["text"],
            score=chunk.get("score", 0),
            page_number=meta.get("page_number"),
        ))

    # Collect which doc IDs were actually searched
    searched_ids = (
        request.doc_ids
        if request.doc_ids
        else [d["doc_id"] for d in ready_docs]
    )

    return ChatResponse(
        answer=answer,
        sources=sources,
        doc_ids_searched=searched_ids,
        tokens_used=tokens,
    )


@router.post("/ask/stream")
async def ask_question_stream(request: ChatRequest):
    """
    Streaming version of /ask.
    Returns Server-Sent Events (SSE) for real-time token streaming.
    Frontend can consume this with EventSource or fetch + ReadableStream.
    """
    all_meta = load_metadata()
    ready_docs = [d for d in all_meta.values() if d["status"] == DocumentStatus.READY]

    if not ready_docs:
        raise HTTPException(status_code=400, detail="No documents ready")

    # Retrieve chunks first (non-streaming)
    vector_service = VectorStoreService()
    raw_chunks = await vector_service.search(
        query=request.question,
        doc_ids=request.doc_ids,
    )

    # Prepare sources to send at the end of stream
    sources = []
    for chunk in raw_chunks:
        meta = chunk.get("metadata", {})
        sources.append({
            "doc_id": meta.get("doc_id", ""),
            "filename": meta.get("filename", "Unknown"),
            "chunk_index": meta.get("chunk_index", 0),
            "content": chunk["text"][:300],
            "score": chunk.get("score", 0),
            "page_number": meta.get("page_number"),
        })

    llm_service = LLMService()

    async def event_generator():
        """Generate SSE events for streaming"""
        try:
            # Stream answer tokens
            async for token in llm_service.stream_answer(
                question=request.question,
                context_chunks=raw_chunks,
                chat_history=request.chat_history or [],
            ):
                # SSE format: "data: {json}\n\n"
                yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

            # Send sources at end of stream
            yield f"data: {json.dumps({'type': 'sources', 'sources': sources})}\n\n"

            # Signal stream completion
            yield f"data: {json.dumps({'type': 'done'})}\n\n"

        except Exception as e:
            logger.error(f"Streaming error: {e}", exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # Disable Nginx buffering
        }
    )
