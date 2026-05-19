"""
Text Chunking Service
Splits documents into overlapping chunks for embedding.
Smart splitting respects sentence boundaries for better coherence.
"""

import re
import logging
from typing import List, Dict, Any
from app.core.config import settings

logger = logging.getLogger(__name__)


class TextChunker:
    """
    Splits text into overlapping chunks.
    
    Why overlap? Without overlap, a sentence split across two chunks
    loses context. Overlap ensures continuity.
    
    Chunk size (800 chars) and overlap (150 chars) are tunable in settings.
    """

    def __init__(
        self,
        chunk_size: int = settings.CHUNK_SIZE,
        chunk_overlap: int = settings.CHUNK_OVERLAP,
    ):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def split_text(self, text: str, doc_id: str, filename: str) -> List[Dict[str, Any]]:
        """
        Split text into chunks with metadata.
        Returns list of chunk dicts ready for embedding.
        """
        if not text or not text.strip():
            return []

        # Clean text: normalize whitespace
        text = self._clean_text(text)

        # Split into raw chunks
        raw_chunks = self._split_into_chunks(text)

        # Build chunk objects with metadata
        chunks = []
        for i, chunk_text in enumerate(raw_chunks):
            if len(chunk_text.strip()) < 50:  # Skip tiny chunks
                continue

            # Try to extract page number from [Page N] markers
            page_num = self._extract_page_number(chunk_text)

            chunks.append({
                "id": f"{doc_id}_chunk_{i}",
                "text": chunk_text.strip(),
                "metadata": {
                    "doc_id": doc_id,
                    "filename": filename,
                    "chunk_index": i,
                    "page_number": page_num,
                    "char_count": len(chunk_text),
                }
            })

        logger.info(f"Split '{filename}' into {len(chunks)} chunks")
        return chunks

    def _split_into_chunks(self, text: str) -> List[str]:
        """
        Split text using a sliding window with sentence-boundary awareness.
        Tries to split at paragraph or sentence boundaries.
        """
        # Priority split points (try paragraph breaks first)
        separators = ["\n\n", "\n", ". ", "! ", "? ", " "]

        chunks = []
        start = 0
        text_len = len(text)

        while start < text_len:
            end = start + self.chunk_size

            if end >= text_len:
                # Last chunk
                chunks.append(text[start:])
                break

            # Try to find a clean break point near the end
            best_break = end
            for sep in separators:
                # Look for separator within last 20% of chunk
                search_start = int(start + self.chunk_size * 0.8)
                pos = text.rfind(sep, search_start, end)
                if pos != -1:
                    best_break = pos + len(sep)
                    break

            chunks.append(text[start:best_break])
            # Move forward but keep overlap for context continuity
            start = best_break - self.chunk_overlap
            if start < 0:
                start = 0

        return chunks

    def _clean_text(self, text: str) -> str:
        """Clean extracted text for better chunking quality"""
        # Normalize multiple newlines
        text = re.sub(r'\n{3,}', '\n\n', text)
        # Remove form feed characters
        text = text.replace('\f', '\n')
        # Normalize spaces (but not newlines)
        text = re.sub(r'[ \t]+', ' ', text)
        return text.strip()

    def _extract_page_number(self, text: str) -> int | None:
        """Extract page number from [Page N] markers inserted by PDF parser"""
        match = re.search(r'\[Page (\d+)\]', text)
        return int(match.group(1)) if match else None
