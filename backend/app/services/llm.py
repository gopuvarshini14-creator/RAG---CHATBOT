"""
LLM Service
Generates answers from retrieved context using OpenAI GPT.
Supports both streaming and non-streaming responses.
"""

import logging
from typing import List, AsyncIterator
from openai import AsyncOpenAI
from app.core.config import settings
from app.services.embeddings import get_openai_client

logger = logging.getLogger(__name__)


# System prompt that instructs the LLM how to behave
RAG_SYSTEM_PROMPT = """You are an expert document analyst and Q&A assistant.
Your job is to answer questions accurately based ONLY on the provided document context.

Rules:
1. Answer ONLY from the provided context. Do not use outside knowledge.
2. If the answer isn't in the context, say "I couldn't find this information in the uploaded documents."
3. Be concise but complete. Use bullet points for lists, headers for sections.
4. Always cite which part of the document supports your answer (e.g., "According to the document...")
5. If multiple documents provide context, mention which document each piece of information comes from.
6. Maintain a helpful, professional tone.
"""

SUMMARY_SYSTEM_PROMPT = """You are an expert document summarizer.
Create clear, well-structured summaries that capture key information accurately.
"""


class LLMService:
    """
    Wraps OpenAI GPT for:
    1. Answering questions with retrieved context (RAG)
    2. Summarizing documents or sections
    3. Streaming responses token by token
    """

    def __init__(self):
        self.model = settings.OPENAI_MODEL

    def _build_rag_prompt(
        self,
        question: str,
        context_chunks: List[dict],
        chat_history: List[dict] = None,
    ) -> List[dict]:
        """
        Build the messages array for the OpenAI API.
        Includes chat history for multi-turn conversations.
        """
        messages = [{"role": "system", "content": RAG_SYSTEM_PROMPT}]

        # Add chat history (last 6 turns to stay within context window)
        if chat_history:
            for msg in chat_history[-6:]:
                messages.append({"role": msg["role"], "content": msg["content"]})

        # Build context string from retrieved chunks
        if context_chunks:
            context_parts = []
            for i, chunk in enumerate(context_chunks, 1):
                meta = chunk.get("metadata", {})
                source_info = f"[Source {i}: {meta.get('filename', 'Unknown')}"
                if meta.get("page_number"):
                    source_info += f", Page {meta['page_number']}"
                source_info += "]"
                context_parts.append(f"{source_info}\n{chunk['text']}")

            context_str = "\n\n---\n\n".join(context_parts)
            user_content = f"""DOCUMENT CONTEXT:
{context_str}

---

QUESTION: {question}

Please answer the question based on the context above."""
        else:
            user_content = f"""No relevant context was found in the uploaded documents.

QUESTION: {question}

Please inform the user that no relevant information was found."""

        messages.append({"role": "user", "content": user_content})
        return messages

    async def generate_answer(
        self,
        question: str,
        context_chunks: List[dict],
        chat_history: List[dict] = None,
    ) -> tuple[str, int]:
        """
        Generate a complete answer (non-streaming).
        Returns (answer_text, tokens_used).
        """
        client = get_openai_client()
        messages = self._build_rag_prompt(question, context_chunks, chat_history)

        response = await client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=0.1,      # Low temperature = more factual, less creative
            max_tokens=1500,
        )

        answer = response.choices[0].message.content
        tokens = response.usage.total_tokens if response.usage else 0
        return answer, tokens

    async def stream_answer(
        self,
        question: str,
        context_chunks: List[dict],
        chat_history: List[dict] = None,
    ) -> AsyncIterator[str]:
        """
        Stream the answer token by token using Server-Sent Events.
        Yields text chunks as they arrive from OpenAI.
        """
        client = get_openai_client()
        messages = self._build_rag_prompt(question, context_chunks, chat_history)

        stream = await client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=0.1,
            max_tokens=1500,
            stream=True,
        )

        async for chunk in stream:
            delta = chunk.choices[0].delta
            if delta.content:
                yield delta.content

    async def summarize(
        self,
        text: str,
        summary_type: str = "concise",
        filename: str = "",
    ) -> tuple[str, int]:
        """
        Summarize document text.
        summary_type: "concise" | "detailed" | "bullets"
        """
        client = get_openai_client()

        type_instructions = {
            "concise": "Write a concise 3-5 sentence summary capturing the main points.",
            "detailed": "Write a detailed summary covering all major topics, key findings, and important details.",
            "bullets": "Write a bullet-point summary with clear sections. Use headers for major topics.",
        }

        instruction = type_instructions.get(summary_type, type_instructions["concise"])

        # Truncate very long documents to fit in context window
        # GPT-4o-mini: 128k context, ~4 chars per token
        max_chars = 80000
        if len(text) > max_chars:
            text = text[:max_chars] + "\n\n[Document truncated for summarization...]"
            logger.warning(f"Document truncated to {max_chars} chars for summarization")

        messages = [
            {"role": "system", "content": SUMMARY_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"""Please summarize the following document{f' ({filename})' if filename else ''}.

{instruction}

DOCUMENT:
{text}"""
            }
        ]

        response = await client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=0.3,
            max_tokens=2000,
        )

        summary = response.choices[0].message.content
        tokens = response.usage.total_tokens if response.usage else 0
        return summary, tokens
