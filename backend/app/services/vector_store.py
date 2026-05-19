# """
# Vector Store Service
# Stores embeddings and performs similarity search.
# Supports ChromaDB (recommended) and FAISS.
# """

# import logging
# import json
# import os
# from typing import List, Dict, Any, Optional
# from app.core.config import settings
# from app.core.database import get_vector_store
# from app.services.embeddings import EmbeddingService

# logger = logging.getLogger(__name__)

# COLLECTION_NAME = "rag_documents"


# class VectorStoreService:
#     """
#     Manages the vector database for storing and retrieving document chunks.
    
#     ChromaDB workflow:
#     1. Create/get a collection (like a table)
#     2. Upsert chunks with their embeddings and metadata
#     3. Query with a question embedding to find similar chunks
#     """

#     def __init__(self):
#         self.embedding_service = EmbeddingService()

#     def _get_collection(self):
#         """Get or create the ChromaDB collection"""
#         client = get_vector_store()
#         return client.get_or_create_collection(
#             name=COLLECTION_NAME,
#             metadata={"hnsw:space": "cosine"}  # Use cosine similarity
#         )

#     async def add_chunks(self, chunks: List[Dict[str, Any]]) -> int:
#     """
#     Embed and store chunks in the vector database.
#     Returns number of chunks stored.
#     """
#     if not chunks:
#         return 0

#     texts = [chunk["text"] for chunk in chunks]
#     ids = [chunk["id"] for chunk in chunks]

#     metadatas = []

#     for chunk in chunks:
#         metadata = {
#             "source": str(chunk["metadata"].get("source", "")),
#             "page": int(chunk["metadata"].get("page", 0) or 0),
#             "doc_id": str(chunk["metadata"].get("doc_id", "")),
#         }

#         metadatas.append(metadata)

#     # Generate embeddings for all chunks
#     logger.info(f"Generating embeddings for {len(chunks)} chunks...")

#     embeddings = await self.embedding_service.embed_texts(texts)

#     if settings.VECTOR_STORE_TYPE == "chroma":
#         collection = self._get_collection()

#         collection.upsert(
#             ids=ids,
#             embeddings=embeddings,
#             documents=texts,
#             metadatas=metadatas
#         )

#         logger.info(f"Stored {len(chunks)} chunks in ChromaDB")

#     elif settings.VECTOR_STORE_TYPE == "faiss":
#         await self._add_to_faiss(ids, embeddings, texts, metadatas)

#     return len(chunks)

# #     async def add_chunks(self, chunks: List[Dict[str, Any]]) -> int:
# #         """
# #         Embed and store chunks in the vector database.
# #         Returns number of chunks stored.
# #         """
# #         if not chunks:
# #             return 0

# #         texts = [chunk["text"] for chunk in chunks]
# #         ids = [chunk["id"] for chunk in chunks]
# #         # metadatas = [chunk["metadata"] for chunk in chunks]
# #         metadatas = []

# # for chunk in chunks:
# #     metadata = {
# #         "source": str(chunk["metadata"].get("source", "")),
# #         "page": int(chunk["metadata"].get("page", 0) or 0),
# #         "doc_id": str(chunk["metadata"].get("doc_id", "")),
# #     }

# #     metadatas.append(metadata)



# #         # Generate embeddings for all chunks
# #         logger.info(f"Generating embeddings for {len(chunks)} chunks...")
# #         embeddings = await self.embedding_service.embed_texts(texts)

# #         if settings.VECTOR_STORE_TYPE == "chroma":
# #             collection = self._get_collection()
# #             # Upsert = insert or update (idempotent)
# #             collection.upsert(
# #                 ids=ids,
# #                 embeddings=embeddings,
# #                 documents=texts,
# #                 metadatas=metadatas
# #             )
# #             logger.info(f"Stored {len(chunks)} chunks in ChromaDB")

# #         elif settings.VECTOR_STORE_TYPE == "faiss":
# #             await self._add_to_faiss(ids, embeddings, texts, metadatas)

# #         return len(chunks)

#     async def search(
#         self,
#         query: str,
#         doc_ids: Optional[List[str]] = None,
#         top_k: int = settings.TOP_K_RESULTS,
#     ) -> List[Dict[str, Any]]:
#         """
#         Find the most relevant chunks for a query.
#         Optionally filter by specific document IDs.
#         """
#         # Embed the query using the same model as the chunks
#         query_embedding = await self.embedding_service.embed_query(query)

#         if settings.VECTOR_STORE_TYPE == "chroma":
#             return await self._search_chroma(query_embedding, doc_ids, top_k)
#         elif settings.VECTOR_STORE_TYPE == "faiss":
#             return await self._search_faiss(query_embedding, doc_ids, top_k)

#         return []

#     async def _search_chroma(
#         self,
#         query_embedding: List[float],
#         doc_ids: Optional[List[str]],
#         top_k: int,
#     ) -> List[Dict[str, Any]]:
#         """ChromaDB similarity search with optional document filter"""
#         collection = self._get_collection()

#         # Build where clause to filter by document if specified
#         where = None
#         if doc_ids:
#             if len(doc_ids) == 1:
#                 where = {"doc_id": {"$eq": doc_ids[0]}}
#             else:
#                 where = {"doc_id": {"$in": doc_ids}}

#         results = collection.query(
#             query_embeddings=[query_embedding],
#             n_results=min(top_k, collection.count() or top_k),
#             where=where,
#             include=["documents", "metadatas", "distances"]
#         )

#         # Format results
#         chunks = []
#         if results["ids"] and results["ids"][0]:
#             for i, doc_id in enumerate(results["ids"][0]):
#                 distance = results["distances"][0][i]
#                 # Convert cosine distance to similarity score (0-1)
#                 score = 1 - distance

#                 if score >= settings.SIMILARITY_THRESHOLD:
#                     chunks.append({
#                         "id": doc_id,
#                         "text": results["documents"][0][i],
#                         "metadata": results["metadatas"][0][i],
#                         "score": round(score, 4),
#                     })

#         return sorted(chunks, key=lambda x: x["score"], reverse=True)

#     async def delete_document(self, doc_id: str) -> int:
#         """Remove all chunks belonging to a document"""
#         if settings.VECTOR_STORE_TYPE == "chroma":
#             collection = self._get_collection()
#             # Get IDs of all chunks for this document
#             results = collection.get(
#                 where={"doc_id": {"$eq": doc_id}},
#                 include=[]
#             )
#             if results["ids"]:
#                 collection.delete(ids=results["ids"])
#                 logger.info(f"Deleted {len(results['ids'])} chunks for doc {doc_id}")
#                 return len(results["ids"])
#         return 0

#     async def get_document_chunks(self, doc_id: str) -> List[Dict[str, Any]]:
#         """Retrieve all chunks for a specific document (for summarization)"""
#         if settings.VECTOR_STORE_TYPE == "chroma":
#             collection = self._get_collection()
#             results = collection.get(
#                 where={"doc_id": {"$eq": doc_id}},
#                 include=["documents", "metadatas"]
#             )
#             chunks = []
#             for i, chunk_id in enumerate(results["ids"]):
#                 chunks.append({
#                     "id": chunk_id,
#                     "text": results["documents"][i],
#                     "metadata": results["metadatas"][i],
#                 })
#             # Sort by chunk index to maintain document order
#             chunks.sort(key=lambda x: x["metadata"].get("chunk_index", 0))
#             return chunks
#         return []

#     # ─── FAISS Support ───────────────────────────────────────────

#     async def _add_to_faiss(self, ids, embeddings, texts, metadatas):
#         """Store chunks in FAISS with a sidecar JSON for metadata"""
#         import faiss
#         import numpy as np

#         index_path = f"{settings.FAISS_INDEX_PATH}.index"
#         meta_path = f"{settings.FAISS_INDEX_PATH}.json"

#         # Load existing index or create new one
#         dim = len(embeddings[0])
#         if os.path.exists(index_path):
#             index = faiss.read_index(index_path)
#             with open(meta_path) as f:
#                 meta_store = json.load(f)
#         else:
#             index = faiss.IndexFlatIP(dim)  # Inner product (cosine with normalized vecs)
#             meta_store = {"ids": [], "texts": [], "metadatas": []}

#         # Normalize vectors for cosine similarity
#         vecs = np.array(embeddings, dtype="float32")
#         faiss.normalize_L2(vecs)

#         index.add(vecs)
#         meta_store["ids"].extend(ids)
#         meta_store["texts"].extend(texts)
#         meta_store["metadatas"].extend(metadatas)

#         faiss.write_index(index, index_path)
#         with open(meta_path, "w") as f:
#             json.dump(meta_store, f)

#     async def _search_faiss(self, query_embedding, doc_ids, top_k):
#         """Search FAISS index"""
#         import faiss
#         import numpy as np

#         index_path = f"{settings.FAISS_INDEX_PATH}.index"
#         meta_path = f"{settings.FAISS_INDEX_PATH}.json"

#         if not os.path.exists(index_path):
#             return []

#         index = faiss.read_index(index_path)
#         with open(meta_path) as f:
#             meta_store = json.load(f)

#         vec = np.array([query_embedding], dtype="float32")
#         faiss.normalize_L2(vec)

#         scores, indices = index.search(vec, min(top_k * 2, index.ntotal))

#         results = []
#         for score, idx in zip(scores[0], indices[0]):
#             if idx < 0:
#                 continue
#             metadata = meta_store["metadatas"][idx]
#             if doc_ids and metadata.get("doc_id") not in doc_ids:
#                 continue
#             if score >= settings.SIMILARITY_THRESHOLD:
#                 results.append({
#                     "id": meta_store["ids"][idx],
#                     "text": meta_store["texts"][idx],
#                     "metadata": metadata,
#                     "score": round(float(score), 4),
#                 })

#         return results[:top_k]
"""
Vector Store Service
Stores embeddings and performs similarity search.
Supports ChromaDB (recommended) and FAISS.
"""

import logging
import json
import os
from typing import List, Dict, Any, Optional
from app.core.config import settings
from app.core.database import get_vector_store
from app.services.embeddings import EmbeddingService

logger = logging.getLogger(__name__)

COLLECTION_NAME = "rag_documents"


class VectorStoreService:
    """
    Manages the vector database for storing and retrieving document chunks.
    
    ChromaDB workflow:
    1. Create/get a collection (like a table)
    2. Upsert chunks with their embeddings and metadata
    3. Query with a question embedding to find similar chunks
    """

    def __init__(self):
        self.embedding_service = EmbeddingService()

    def _get_collection(self):
        """Get or create the ChromaDB collection"""
        client = get_vector_store()
        return client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"}  # Use cosine similarity
        )
        
    async def add_chunks(self, chunks: List[Dict[str, Any]]) -> int:
        """
        Embed and store chunks in the vector database.
        Returns number of chunks stored.
        """
        if not chunks:
            return 0

        texts = [chunk["text"] for chunk in chunks]
        ids = [chunk["id"] for chunk in chunks]

        metadatas = []

        for chunk in chunks:
            metadata = {
    "source": str(chunk["metadata"].get("source", "")),
    "page": int(chunk["metadata"].get("page", 0) or 0),
    "doc_id": str(chunk["metadata"].get("doc_id", "")),
    "chunk_index": int(chunk["metadata"].get("chunk_index", 0) or 0),
}

            metadatas.append(metadata)

        # Generate embeddings for all chunks
        logger.info(f"Generating embeddings for {len(chunks)} chunks...")

        embeddings = await self.embedding_service.embed_texts(texts)

        if settings.VECTOR_STORE_TYPE == "chroma":
            collection = self._get_collection()

            collection.upsert(
                ids=ids,
                embeddings=embeddings,
                documents=texts,
                metadatas=metadatas
            )

            logger.info(f"Stored {len(chunks)} chunks in ChromaDB")

        elif settings.VECTOR_STORE_TYPE == "faiss":
            await self._add_to_faiss(ids, embeddings, texts, metadatas)

        return len(chunks)

    async def search(
        self,
        query: str,
        doc_ids: Optional[List[str]] = None,
        top_k: int = settings.TOP_K_RESULTS,
    ) -> List[Dict[str, Any]]:
        """
        Find the most relevant chunks for a query.
        Optionally filter by specific document IDs.
        """
        # Embed the query using the same model as the chunks
        query_embedding = await self.embedding_service.embed_query(query)

        if settings.VECTOR_STORE_TYPE == "chroma":
            return await self._search_chroma(query_embedding, doc_ids, top_k)
        elif settings.VECTOR_STORE_TYPE == "faiss":
            return await self._search_faiss(query_embedding, doc_ids, top_k)

        return []

    async def _search_chroma(
        self,
        query_embedding: List[float],
        doc_ids: Optional[List[str]],
        top_k: int,
    ) -> List[Dict[str, Any]]:
        """ChromaDB similarity search with optional document filter"""
        collection = self._get_collection()

        # Build where clause to filter by document if specified
        where = None
        if doc_ids:
            if len(doc_ids) == 1:
                where = {"doc_id": {"$eq": doc_ids[0]}}
            else:
                where = {"doc_id": {"$in": doc_ids}}

        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=min(top_k, collection.count() or top_k),
            where=where,
            include=["documents", "metadatas", "distances"]
        )

        # Format results
        chunks = []
        if results["ids"] and results["ids"][0]:
            for i, doc_id in enumerate(results["ids"][0]):
                distance = results["distances"][0][i]
                # Convert cosine distance to similarity score (0-1)
                score = 1 - distance

                if True:
                    chunks.append({
                        "id": doc_id,
                        "text": results["documents"][0][i],
                        "metadata": results["metadatas"][0][i],
                        "score": round(score, 4),
                    })

        return sorted(chunks, key=lambda x: x["score"], reverse=True)

    async def delete_document(self, doc_id: str) -> int:
        """Remove all chunks belonging to a document"""
        if settings.VECTOR_STORE_TYPE == "chroma":
            collection = self._get_collection()
            # Get IDs of all chunks for this document
            results = collection.get(
                where={"doc_id": {"$eq": doc_id}},
                include=[]
            )
            if results["ids"]:
                collection.delete(ids=results["ids"])
                logger.info(f"Deleted {len(results['ids'])} chunks for doc {doc_id}")
                return len(results["ids"])
        return 0

    async def get_document_chunks(self, doc_id: str) -> List[Dict[str, Any]]:
        """Retrieve all chunks for a specific document (for summarization)"""
        if settings.VECTOR_STORE_TYPE == "chroma":
            collection = self._get_collection()
            results = collection.get(
                where={"doc_id": {"$eq": doc_id}},
                include=["documents", "metadatas"]
            )
            chunks = []
            for i, chunk_id in enumerate(results["ids"]):
                chunks.append({
                    "id": chunk_id,
                    "text": results["documents"][i],
                    "metadata": results["metadatas"][i],
                })
            # Sort by chunk index to maintain document order
            chunks.sort(key=lambda x: x["metadata"].get("chunk_index", 0))
            return chunks
        return []

    # ─── FAISS Support ───────────────────────────────────────────

    async def _add_to_faiss(self, ids, embeddings, texts, metadatas):
        """Store chunks in FAISS with a sidecar JSON for metadata"""
        import faiss
        import numpy as np

        index_path = f"{settings.FAISS_INDEX_PATH}.index"
        meta_path = f"{settings.FAISS_INDEX_PATH}.json"

        # Load existing index or create new one
        dim = len(embeddings[0])
        if os.path.exists(index_path):
            index = faiss.read_index(index_path)
            with open(meta_path) as f:
                meta_store = json.load(f)
        else:
            index = faiss.IndexFlatIP(dim)  # Inner product (cosine with normalized vecs)
            meta_store = {"ids": [], "texts": [], "metadatas": []}

        # Normalize vectors for cosine similarity
        vecs = np.array(embeddings, dtype="float32")
        faiss.normalize_L2(vecs)

        index.add(vecs)
        meta_store["ids"].extend(ids)
        meta_store["texts"].extend(texts)
        meta_store["metadatas"].extend(metadatas)

        faiss.write_index(index, index_path)
        with open(meta_path, "w") as f:
            json.dump(meta_store, f)

    async def _search_faiss(self, query_embedding, doc_ids, top_k):
        """Search FAISS index"""
        import faiss
        import numpy as np

        index_path = f"{settings.FAISS_INDEX_PATH}.index"
        meta_path = f"{settings.FAISS_INDEX_PATH}.json"

        if not os.path.exists(index_path):
            return []

        index = faiss.read_index(index_path)
        with open(meta_path) as f:
            meta_store = json.load(f)

        vec = np.array([query_embedding], dtype="float32")
        faiss.normalize_L2(vec)

        scores, indices = index.search(vec, min(top_k * 2, index.ntotal))

        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx < 0:
                continue
            metadata = meta_store["metadatas"][idx]
            if doc_ids and metadata.get("doc_id") not in doc_ids:
                continue
            if score >= settings.SIMILARITY_THRESHOLD:
                results.append({
                    "id": meta_store["ids"][idx],
                    "text": meta_store["texts"][idx],
                    "metadata": metadata,
                    "score": round(float(score), 4),
                })

        return results[:top_k]
