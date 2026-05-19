"""
Document Metadata Store
SQLite-backed persistent storage for document metadata.
Drop-in replacement for the JSON file store used in development.

Why SQLite over JSON?
- Concurrent access safe (no file corruption)
- Faster queries for large document counts
- ACID transactions
- Easy migration to PostgreSQL (change connection string)

Usage:
    store = DocumentMetaStore()
    store.save(doc_id, metadata_dict)
    doc = store.get(doc_id)
    all_docs = store.list_all()
    store.delete(doc_id)
"""

import sqlite3
import json
import logging
import os
from datetime import datetime
from typing import Optional
from contextlib import contextmanager
from threading import Lock

logger = logging.getLogger(__name__)

DB_PATH = os.environ.get("META_DB_PATH", "./uploads/documents.db")


class DocumentMetaStore:
    """Thread-safe SQLite document metadata store"""

    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path
        self._lock = Lock()
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        self._init_db()

    @contextmanager
    def _conn(self):
        """Context manager for database connections"""
        conn = sqlite3.connect(self.db_path, timeout=10)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")   # Better concurrency
        conn.execute("PRAGMA foreign_keys=ON")
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def _init_db(self):
        """Create tables if they don't exist"""
        with self._conn() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS documents (
                    doc_id      TEXT PRIMARY KEY,
                    filename    TEXT NOT NULL,
                    file_type   TEXT NOT NULL,
                    file_size   INTEGER NOT NULL,
                    file_path   TEXT,
                    chunk_count INTEGER DEFAULT 0,
                    page_count  INTEGER,
                    status      TEXT DEFAULT 'processing',
                    error       TEXT,
                    file_hash   TEXT,
                    uploaded_at TEXT NOT NULL,
                    updated_at  TEXT NOT NULL,
                    extra       TEXT  -- JSON for arbitrary extra metadata
                )
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_status ON documents(status)
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_uploaded ON documents(uploaded_at)
            """)
        logger.info(f"Document metadata DB ready at {self.db_path}")

    def save(self, doc_id: str, data: dict):
        """Insert or update document metadata"""
        now = datetime.now().isoformat()
        extra = {k: v for k, v in data.items() if k not in {
            "doc_id", "filename", "file_type", "file_size",
            "file_path", "chunk_count", "page_count", "status",
            "error", "file_hash", "uploaded_at"
        }}

        with self._lock, self._conn() as conn:
            conn.execute("""
                INSERT INTO documents
                    (doc_id, filename, file_type, file_size, file_path,
                     chunk_count, page_count, status, error, file_hash,
                     uploaded_at, updated_at, extra)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
                ON CONFLICT(doc_id) DO UPDATE SET
                    chunk_count = excluded.chunk_count,
                    page_count  = excluded.page_count,
                    status      = excluded.status,
                    error       = excluded.error,
                    file_hash   = excluded.file_hash,
                    updated_at  = excluded.updated_at,
                    extra       = excluded.extra
            """, (
                doc_id,
                data.get("filename", ""),
                data.get("file_type", ""),
                data.get("file_size", 0),
                data.get("file_path"),
                data.get("chunk_count", 0),
                data.get("page_count"),
                data.get("status", "processing"),
                data.get("error"),
                data.get("file_hash"),
                data.get("uploaded_at", now),
                now,
                json.dumps(extra) if extra else None,
            ))

    def get(self, doc_id: str) -> Optional[dict]:
        """Retrieve metadata for a single document"""
        with self._conn() as conn:
            row = conn.execute(
                "SELECT * FROM documents WHERE doc_id = ?", (doc_id,)
            ).fetchone()

        if not row:
            return None
        return self._row_to_dict(row)

    def list_all(self, status_filter: Optional[str] = None) -> list[dict]:
        """List all documents, optionally filtered by status"""
        query = "SELECT * FROM documents"
        params = []
        if status_filter:
            query += " WHERE status = ?"
            params.append(status_filter)
        query += " ORDER BY uploaded_at DESC"

        with self._conn() as conn:
            rows = conn.execute(query, params).fetchall()

        return [self._row_to_dict(r) for r in rows]

    def update_status(self, doc_id: str, status: str, **kwargs):
        """Quick update for status changes"""
        data = self.get(doc_id) or {}
        data.update({"status": status, **kwargs})
        self.save(doc_id, data)

    def delete(self, doc_id: str) -> bool:
        """Delete document metadata. Returns True if deleted."""
        with self._lock, self._conn() as conn:
            cursor = conn.execute(
                "DELETE FROM documents WHERE doc_id = ?", (doc_id,)
            )
            return cursor.rowcount > 0

    def count(self, status: Optional[str] = None) -> int:
        """Count documents"""
        query = "SELECT COUNT(*) FROM documents"
        params = []
        if status:
            query += " WHERE status = ?"
            params.append(status)
        with self._conn() as conn:
            return conn.execute(query, params).fetchone()[0]

    def _row_to_dict(self, row: sqlite3.Row) -> dict:
        d = dict(row)
        # Parse extra JSON
        if d.get("extra"):
            try:
                extra = json.loads(d.pop("extra"))
                d.update(extra)
            except Exception:
                d.pop("extra", None)
        return d


# Singleton instance
_store: Optional[DocumentMetaStore] = None


def get_meta_store() -> DocumentMetaStore:
    """Get or create the singleton metadata store"""
    global _store
    if _store is None:
        _store = DocumentMetaStore()
    return _store
