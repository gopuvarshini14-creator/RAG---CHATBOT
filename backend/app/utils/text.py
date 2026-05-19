"""
Utility Functions
Text helpers, file validation, token estimation, and more.
"""

import os
import re
import hashlib
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


# ─── File Utilities ───────────────────────────────────────────

def get_file_extension(filename: str) -> str:
    """Extract lowercase extension without dot: 'doc.PDF' → 'pdf'"""
    return Path(filename).suffix.lower().strip(".")


def safe_filename(filename: str) -> str:
    """
    Sanitize a filename to be filesystem-safe.
    Removes special chars, preserves extension.
    """
    name = Path(filename).stem
    ext = Path(filename).suffix
    # Keep only alphanumeric, hyphens, underscores, spaces
    safe = re.sub(r"[^\w\s\-]", "", name).strip()
    safe = re.sub(r"\s+", "_", safe)
    return f"{safe[:100]}{ext}"  # Limit to 100 chars


def file_hash(file_path: str) -> str:
    """SHA-256 hash of a file — useful for deduplication"""
    sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            sha256.update(chunk)
    return sha256.hexdigest()


def format_file_size(bytes: int) -> str:
    """Human-readable file size: 1536000 → '1.5 MB'"""
    for unit in ["B", "KB", "MB", "GB"]:
        if bytes < 1024:
            return f"{bytes:.1f} {unit}"
        bytes /= 1024
    return f"{bytes:.1f} TB"


# ─── Text Utilities ───────────────────────────────────────────

def clean_text(text: str) -> str:
    """
    Normalize text extracted from documents.
    Handles common OCR artifacts and encoding issues.
    """
    if not text:
        return ""

    # Normalize unicode (NFC form)
    import unicodedata
    text = unicodedata.normalize("NFC", text)

    # Replace common OCR artifacts
    text = text.replace("\x00", "")     # Null bytes
    text = text.replace("\r\n", "\n")   # Windows line endings
    text = text.replace("\r", "\n")     # Old Mac line endings
    text = re.sub(r"\f", "\n\n", text)  # Form feeds → paragraph break

    # Normalize whitespace (but preserve newlines)
    text = re.sub(r"[ \t]+", " ", text)        # Multiple spaces → one
    text = re.sub(r"\n{4,}", "\n\n\n", text)    # Cap at 3 newlines

    # Remove lines that are just page numbers or headers (common in PDFs)
    lines = text.split("\n")
    cleaned_lines = []
    for line in lines:
        stripped = line.strip()
        # Skip standalone page numbers, form feed artifacts
        if re.match(r"^\d{1,4}$", stripped):
            continue
        cleaned_lines.append(line)

    return "\n".join(cleaned_lines).strip()


def truncate_text(text: str, max_chars: int, suffix: str = "...") -> str:
    """Truncate text at a word boundary"""
    if len(text) <= max_chars:
        return text
    truncated = text[:max_chars - len(suffix)]
    # Find last space to avoid cutting mid-word
    last_space = truncated.rfind(" ")
    if last_space > max_chars * 0.8:
        truncated = truncated[:last_space]
    return truncated + suffix


def count_words(text: str) -> int:
    """Count words in text"""
    return len(text.split())


# ─── Token Estimation ─────────────────────────────────────────

def estimate_tokens(text: str) -> int:
    """
    Fast token estimate without calling tiktoken.
    Rule of thumb: 1 token ≈ 4 characters for English text.
    Accurate to within ~10%.
    """
    return len(text) // 4


def estimate_tokens_accurate(text: str, model: str = "gpt-4o-mini") -> int:
    """
    Accurate token count using tiktoken.
    Slower but precise — use for context window management.
    """
    try:
        import tiktoken
        enc = tiktoken.encoding_for_model(model)
        return len(enc.encode(text))
    except Exception:
        # Fall back to estimate if tiktoken not available
        return estimate_tokens(text)


def fits_in_context(text: str, max_tokens: int = 12000) -> bool:
    """Check if text fits within LLM context window"""
    return estimate_tokens(text) <= max_tokens


# ─── Document Deduplication ───────────────────────────────────

def check_duplicate(file_path: str, existing_hashes: dict) -> Optional[str]:
    """
    Check if a file is a duplicate of an already-uploaded document.
    Returns the doc_id of the duplicate, or None if unique.
    """
    new_hash = file_hash(file_path)
    for doc_id, stored_hash in existing_hashes.items():
        if stored_hash == new_hash:
            return doc_id
    return None


# ─── Markdown Helpers ─────────────────────────────────────────

def extract_headings(text: str) -> list[str]:
    """Extract section headings from document text (for navigation)"""
    headings = []
    for line in text.split("\n"):
        stripped = line.strip()
        # Markdown headings
        if stripped.startswith("#"):
            heading = stripped.lstrip("#").strip()
            if heading:
                headings.append(heading)
        # ALL CAPS lines that look like headings
        elif stripped.isupper() and 5 < len(stripped) < 80:
            headings.append(stripped.title())
    return headings[:20]  # Return first 20 headings


def highlight_query_terms(text: str, query: str, context_chars: int = 200) -> str:
    """
    Find the most relevant snippet of text for a query.
    Returns a short excerpt with the query terms present.
    """
    query_words = [w.lower() for w in query.split() if len(w) > 3]
    if not query_words:
        return text[:context_chars]

    text_lower = text.lower()
    best_pos = 0
    best_score = 0

    # Scan for windows with most query term matches
    window = context_chars
    for i in range(0, len(text) - window, 50):
        snippet = text_lower[i:i + window]
        score = sum(1 for word in query_words if word in snippet)
        if score > best_score:
            best_score = score
            best_pos = i

    start = max(0, best_pos)
    end = min(len(text), start + context_chars)
    snippet = text[start:end]

    prefix = "..." if start > 0 else ""
    suffix = "..." if end < len(text) else ""
    return f"{prefix}{snippet}{suffix}"
