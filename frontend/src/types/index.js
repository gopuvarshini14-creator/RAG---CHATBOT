/**
 * @fileoverview Type definitions for the RAG application
 * These are JSDoc types — works without TypeScript,
 * gives you IDE autocomplete and type safety.
 *
 * To migrate to TypeScript, rename to types.ts and
 * convert @typedef to interface/type declarations.
 */

/**
 * @typedef {'processing' | 'ready' | 'error'} DocumentStatus
 */

/**
 * @typedef {Object} DocumentMetadata
 * @property {string} doc_id - Unique document identifier (UUID)
 * @property {string} filename - Original filename
 * @property {'pdf' | 'docx' | 'txt'} file_type - File extension
 * @property {number} file_size - File size in bytes
 * @property {number} chunk_count - Number of text chunks indexed
 * @property {string} uploaded_at - ISO 8601 timestamp
 * @property {DocumentStatus} status - Processing status
 * @property {string} [error] - Error message if status is 'error'
 * @property {number} [page_count] - Page count (PDF only)
 */

/**
 * @typedef {Object} ChunkSource
 * @property {string} doc_id - Document this chunk belongs to
 * @property {string} filename - Source filename
 * @property {number} chunk_index - Chunk position in document
 * @property {string} content - Chunk text (truncated to 300 chars)
 * @property {number} score - Similarity score 0-1
 * @property {number | null} page_number - Page number if available
 */

/**
 * @typedef {Object} ChatMessage
 * @property {number} id - Local message ID (timestamp-based)
 * @property {'user' | 'assistant'} role - Message sender
 * @property {string} content - Message text (supports Markdown)
 * @property {string} timestamp - ISO 8601 timestamp
 * @property {ChunkSource[] | null} sources - Source citations (assistant only)
 */

/**
 * @typedef {Object} ChatRequest
 * @property {string} question - User's question
 * @property {string[] | null} doc_ids - Filter to these docs (null = all)
 * @property {Array<{role: string, content: string}>} chat_history - Conversation history
 * @property {boolean} stream - Whether to stream the response
 */

/**
 * @typedef {Object} ChatResponse
 * @property {string} answer - LLM-generated answer
 * @property {ChunkSource[]} sources - Retrieved chunks used as context
 * @property {string[]} doc_ids_searched - Documents searched
 * @property {number | null} tokens_used - Total OpenAI tokens consumed
 */

/**
 * @typedef {Object} SummaryRequest
 * @property {string} doc_id - Document to summarize
 * @property {'concise' | 'detailed' | 'bullets'} summary_type - Summary style
 * @property {string | null} section_text - Specific section to summarize
 */

/**
 * @typedef {Object} SummaryResponse
 * @property {string} summary - Generated summary text (Markdown)
 * @property {string} doc_id - Document that was summarized
 * @property {number | null} tokens_used - OpenAI tokens consumed
 */

/**
 * @typedef {Object} AppSettings
 * @property {boolean} streamingEnabled - Use SSE streaming for chat
 * @property {boolean} showSourcesByDefault - Auto-expand source citations
 * @property {number} topK - Chunks to retrieve per query
 * @property {number} similarityThreshold - Min similarity score
 * @property {'concise' | 'detailed' | 'bullets'} summaryType - Default summary type
 * @property {number} maxHistoryTurns - Chat turns in context
 */

/**
 * @typedef {Object} StreamEvent
 * @property {'token' | 'sources' | 'done' | 'error'} type - Event type
 * @property {string} [content] - Token text (type='token')
 * @property {ChunkSource[]} [sources] - Sources (type='sources')
 * @property {string} [message] - Error message (type='error')
 */

// Export empty object so this can be imported as a module in JSDoc
export {}
