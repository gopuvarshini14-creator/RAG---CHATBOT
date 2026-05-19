"""
Backend Test Suite
Tests for document processing pipeline and API endpoints.

Run with:
    cd backend
    pip install pytest pytest-asyncio httpx
    pytest tests/ -v

For coverage:
    pytest tests/ --cov=app --cov-report=html
"""

import pytest
import asyncio
import os
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

# ─── Fixtures ─────────────────────────────────────────────────

@pytest.fixture
def sample_text():
    return """
    Introduction to Machine Learning

    Machine learning is a subset of artificial intelligence that enables
    computers to learn from data without being explicitly programmed.

    Key Concepts

    Supervised Learning: The algorithm learns from labeled training data.
    Examples include linear regression and neural networks.

    Unsupervised Learning: The algorithm finds patterns in unlabeled data.
    Examples include clustering and dimensionality reduction.

    Reinforcement Learning: The agent learns by interacting with an environment
    and receiving rewards or penalties.

    Applications

    Machine learning is used in image recognition, natural language processing,
    recommendation systems, and many other fields.
    """

@pytest.fixture
def sample_pdf_path(tmp_path):
    """Create a minimal test PDF"""
    pdf_path = tmp_path / "test.pdf"
    # Create a simple text file to simulate PDF (for unit tests without PyMuPDF)
    pdf_path.write_text("This is a test document about machine learning.")
    return str(pdf_path)


@pytest.fixture
def sample_txt_path(tmp_path, sample_text):
    txt_path = tmp_path / "test.txt"
    txt_path.write_text(sample_text)
    return str(txt_path)


# ─── Chunker Tests ────────────────────────────────────────────

class TestTextChunker:

    def test_basic_split(self, sample_text):
        from app.services.chunker import TextChunker
        chunker = TextChunker(chunk_size=300, chunk_overlap=50)
        chunks = chunker.split_text(sample_text, "doc-123", "test.txt")

        assert len(chunks) > 0, "Should produce at least one chunk"
        for chunk in chunks:
            assert "id" in chunk
            assert "text" in chunk
            assert "metadata" in chunk
            assert chunk["metadata"]["doc_id"] == "doc-123"

    def test_chunk_size_respected(self, sample_text):
        from app.services.chunker import TextChunker
        chunk_size = 400
        chunker = TextChunker(chunk_size=chunk_size, chunk_overlap=50)
        chunks = chunker.split_text(sample_text, "doc-1", "test.txt")

        # Each chunk should be at most 2x chunk_size (due to sentence boundary search)
        for chunk in chunks:
            assert len(chunk["text"]) < chunk_size * 2, \
                f"Chunk too large: {len(chunk['text'])} chars"

    def test_overlap_creates_continuity(self, sample_text):
        from app.services.chunker import TextChunker
        chunker = TextChunker(chunk_size=300, chunk_overlap=100)
        chunks = chunker.split_text(sample_text, "doc-1", "test.txt")

        if len(chunks) >= 2:
            # End of chunk N should overlap with start of chunk N+1
            end_of_first = chunks[0]["text"][-80:]
            start_of_second = chunks[1]["text"][:80]
            # At least some words should be shared (overlap)
            words_first = set(end_of_first.lower().split())
            words_second = set(start_of_second.lower().split())
            overlap = words_first & words_second
            assert len(overlap) > 0, "Chunks should have overlapping content"

    def test_empty_text(self):
        from app.services.chunker import TextChunker
        chunker = TextChunker()
        chunks = chunker.split_text("", "doc-1", "empty.txt")
        assert chunks == [], "Empty text should produce no chunks"

    def test_tiny_text(self):
        from app.services.chunker import TextChunker
        chunker = TextChunker()
        chunks = chunker.split_text("Hello world.", "doc-1", "tiny.txt")
        # Too short to chunk (< 50 chars), should produce no chunks
        assert len(chunks) == 0

    def test_chunk_metadata_complete(self, sample_text):
        from app.services.chunker import TextChunker
        chunker = TextChunker(chunk_size=300, chunk_overlap=50)
        chunks = chunker.split_text(sample_text, "abc-123", "my_doc.pdf")

        for chunk in chunks:
            meta = chunk["metadata"]
            assert meta["doc_id"] == "abc-123"
            assert meta["filename"] == "my_doc.pdf"
            assert "chunk_index" in meta
            assert "char_count" in meta


# ─── Parser Tests ─────────────────────────────────────────────

class TestDocumentParser:

    def test_parse_txt(self, sample_txt_path, sample_text):
        from app.services.parser import DocumentParser
        text, meta = DocumentParser.extract_text(sample_txt_path, "txt")
        assert "Machine Learning" in text
        assert isinstance(meta, dict)

    def test_parse_unknown_type(self, tmp_path):
        from app.services.parser import DocumentParser
        with pytest.raises(ValueError, match="Unsupported file type"):
            DocumentParser.extract_text(str(tmp_path / "x.xyz"), "xyz")

    def test_parse_txt_encoding(self, tmp_path):
        from app.services.parser import DocumentParser
        # Test Latin-1 encoded file
        txt_path = tmp_path / "latin.txt"
        txt_path.write_bytes("Café résumé naïve".encode("latin-1"))
        text, meta = DocumentParser.extract_text(str(txt_path), "txt")
        assert len(text) > 0


# ─── Utility Tests ────────────────────────────────────────────

class TestTextUtils:

    def test_clean_text(self):
        from app.utils.text import clean_text
        dirty = "Hello\r\nWorld\x00Foo   bar"
        clean = clean_text(dirty)
        assert "\x00" not in clean
        assert "\r" not in clean
        assert "  " not in clean  # No double spaces

    def test_estimate_tokens(self):
        from app.utils.text import estimate_tokens
        text = "a" * 400  # 400 chars ≈ 100 tokens
        tokens = estimate_tokens(text)
        assert 80 <= tokens <= 120, f"Token estimate {tokens} out of expected range"

    def test_truncate_text(self):
        from app.utils.text import truncate_text
        text = "word " * 100  # 500 chars
        result = truncate_text(text, 50)
        assert len(result) <= 53  # 50 + "..." length
        assert result.endswith("...")

    def test_truncate_short_text(self):
        from app.utils.text import truncate_text
        text = "Short text"
        assert truncate_text(text, 100) == text

    def test_format_file_size(self):
        from app.utils.text import format_file_size
        assert "B" in format_file_size(500)
        assert "KB" in format_file_size(1500)
        assert "MB" in format_file_size(2_000_000)

    def test_safe_filename(self):
        from app.utils.text import safe_filename
        assert safe_filename("My Doc (1).pdf") == "My_Doc_1.pdf"
        assert safe_filename("../../../etc/passwd") == "etcpasswd"

    def test_extract_headings(self):
        from app.utils.text import extract_headings
        text = "# Introduction\nSome text.\n## Methods\nMore text.\n### Results"
        headings = extract_headings(text)
        assert "Introduction" in headings
        assert "Methods" in headings


# ─── Metadata Store Tests ─────────────────────────────────────

class TestDocumentMetaStore:

    @pytest.fixture
    def store(self, tmp_path):
        from app.utils.metadata_store import DocumentMetaStore
        return DocumentMetaStore(db_path=str(tmp_path / "test.db"))

    def test_save_and_get(self, store):
        data = {
            "doc_id": "doc-1",
            "filename": "test.pdf",
            "file_type": "pdf",
            "file_size": 1024,
            "status": "ready",
            "chunk_count": 10,
            "uploaded_at": "2024-01-01T00:00:00",
        }
        store.save("doc-1", data)
        retrieved = store.get("doc-1")

        assert retrieved is not None
        assert retrieved["filename"] == "test.pdf"
        assert retrieved["status"] == "ready"
        assert retrieved["chunk_count"] == 10

    def test_list_all(self, store):
        for i in range(3):
            store.save(f"doc-{i}", {
                "doc_id": f"doc-{i}",
                "filename": f"file{i}.pdf",
                "file_type": "pdf",
                "file_size": 1000,
                "status": "ready",
                "uploaded_at": f"2024-01-0{i+1}T00:00:00",
            })
        docs = store.list_all()
        assert len(docs) == 3

    def test_update_status(self, store):
        store.save("doc-1", {
            "doc_id": "doc-1", "filename": "f.pdf", "file_type": "pdf",
            "file_size": 1, "status": "processing", "uploaded_at": "2024-01-01T00:00:00"
        })
        store.update_status("doc-1", "ready", chunk_count=5)
        doc = store.get("doc-1")
        assert doc["status"] == "ready"

    def test_delete(self, store):
        store.save("doc-del", {
            "doc_id": "doc-del", "filename": "del.txt", "file_type": "txt",
            "file_size": 10, "status": "ready", "uploaded_at": "2024-01-01T00:00:00"
        })
        assert store.delete("doc-del") is True
        assert store.get("doc-del") is None
        assert store.delete("doc-del") is False  # Already gone

    def test_count(self, store):
        assert store.count() == 0
        store.save("d1", {"doc_id": "d1", "filename": "a.pdf", "file_type": "pdf",
                          "file_size": 1, "status": "ready", "uploaded_at": "2024-01-01"})
        assert store.count() == 1
        assert store.count(status="ready") == 1
        assert store.count(status="processing") == 0


# ─── API Integration Tests ────────────────────────────────────

@pytest.mark.asyncio
class TestDocumentsAPI:
    """
    Integration tests for document upload API.
    These mock the vector store to avoid needing a real ChromaDB/OpenAI.
    """

    @pytest.fixture
    async def client(self, tmp_path):
        """Create a test client with mocked dependencies"""
        import sys
        # Set env vars before importing app
        os.environ["OPENAI_API_KEY"] = "test-key"
        os.environ["UPLOAD_DIR"] = str(tmp_path / "uploads")
        os.environ["CHROMA_PERSIST_DIR"] = str(tmp_path / "chroma")

        from httpx import AsyncClient, ASGITransport
        from main import app

        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test"
        ) as client:
            yield client

    async def test_health_check(self, client):
        response = await client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"

    async def test_list_documents_empty(self, client):
        response = await client.get("/api/documents/")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert data["documents"] == []

    async def test_upload_invalid_type(self, client, tmp_path):
        bad_file = tmp_path / "test.exe"
        bad_file.write_text("not allowed")
        with open(bad_file, "rb") as f:
            response = await client.post(
                "/api/documents/upload",
                files={"file": ("test.exe", f, "application/octet-stream")}
            )
        assert response.status_code == 400
        assert "not supported" in response.json()["detail"]

    async def test_get_nonexistent_document(self, client):
        response = await client.get("/api/documents/nonexistent-id")
        assert response.status_code == 404


# ─── Test Configuration ───────────────────────────────────────

@pytest.fixture(scope="session")
def event_loop():
    """Use a single event loop for all async tests"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()
