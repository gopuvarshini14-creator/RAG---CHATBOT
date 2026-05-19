"""
Embedding Service
Generates vector embeddings for text chunks using OpenAI.
Embeddings convert text into numerical vectors for similarity search.
"""

import logging
from typing import List
from openai import AsyncOpenAI
from app.core.config import settings

logger = logging.getLogger(__name__)

# Reuse client across requests (connection pooling)
_client: AsyncOpenAI | None = None


def get_openai_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        if not settings.OPENAI_API_KEY:
            raise ValueError(
                "OPENAI_API_KEY not set. Add it to your .env file."
            )
        _client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    return _client


class EmbeddingService:
    """
    Generates embeddings using OpenAI text-embedding-3-small.
    
    Embedding dimension: 1536 (text-embedding-3-small)
    Cost: ~$0.02 per 1M tokens (very cheap)
    
    For open-source alternative, see SentenceTransformerEmbedding below.
    """

    def __init__(self):
        self.model = settings.OPENAI_EMBED_MODEL
        self.batch_size = 100  # OpenAI supports up to 2048 inputs per request

    async def embed_texts(self, texts: List[str]) -> List[List[float]]:
        """
        Generate embeddings for a list of texts.
        Automatically batches large lists.
        """
        if not texts:
            return []

        client = get_openai_client()
        all_embeddings = []

        # Process in batches to avoid API limits
        for i in range(0, len(texts), self.batch_size):
            batch = texts[i:i + self.batch_size]

            # Clean texts (API rejects empty strings)
            batch = [t.strip() or " " for t in batch]

            logger.info(f"Embedding batch {i//self.batch_size + 1} ({len(batch)} texts)...")
            response = await client.embeddings.create(
                model=self.model,
                input=batch,
                encoding_format="float"
            )

            embeddings = [item.embedding for item in response.data]
            all_embeddings.extend(embeddings)

        return all_embeddings

    async def embed_query(self, query: str) -> List[float]:
        """Embed a single query string for retrieval"""
        embeddings = await self.embed_texts([query])
        return embeddings[0]


# ─────────────────────────────────────────────────────────────
# Open-source alternative: SentenceTransformers (no API key needed)
# Uncomment and use this class instead of EmbeddingService if you
# want to run everything locally without OpenAI costs.
# ─────────────────────────────────────────────────────────────

# class SentenceTransformerEmbedding:
#     """
#     Free, local embeddings using sentence-transformers.
#     Model: all-MiniLM-L6-v2 (fast, good quality, 384 dimensions)
#     Install: pip install sentence-transformers
#     """
#
#     def __init__(self):
#         from sentence_transformers import SentenceTransformer
#         self.model = SentenceTransformer("all-MiniLM-L6-v2")
#
#     async def embed_texts(self, texts: List[str]) -> List[List[float]]:
#         import asyncio
#         loop = asyncio.get_event_loop()
#         # Run CPU-bound encoding in thread pool
#         embeddings = await loop.run_in_executor(
#             None, lambda: self.model.encode(texts, show_progress_bar=False).tolist()
#         )
#         return embeddings
#
#     async def embed_query(self, query: str) -> List[float]:
#         embeddings = await self.embed_texts([query])
#         return embeddings[0]
