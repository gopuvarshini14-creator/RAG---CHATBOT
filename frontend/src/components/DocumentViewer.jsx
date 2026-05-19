/**
 * DocumentViewer Component
 * Shows a preview of document chunks in a modal.
 * Useful for verifying what was extracted from a document.
 */

import { useState, useEffect } from 'react'
import { X, FileText, Hash, ChevronLeft, ChevronRight, Search, Loader } from 'lucide-react'
import { documentsApi } from '../services/api'

export default function DocumentViewer({ doc, onClose }) {
  const [chunks, setChunks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const CHUNKS_PER_PAGE = 5

  useEffect(() => {
    async function loadChunks() {
      try {
        // Use summary API to get chunk count info
        // In a real app you'd have a /documents/{id}/chunks endpoint
        const info = await documentsApi.get(doc.doc_id)
        // For now show doc metadata since we don't expose chunks directly
        setChunks([{
          text: `This document has ${info.chunk_count} chunks indexed.
File: ${info.filename}
Type: ${info.file_type.toUpperCase()}
Size: ${(info.file_size / 1024).toFixed(1)} KB
Status: ${info.status}
${info.page_count ? `Pages: ${info.page_count}` : ''}

The document has been processed and is ready for Q&A.
Use the chat window to ask questions about this document.`,
          metadata: { chunk_index: 0, page_number: null }
        }])
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    loadChunks()
  }, [doc.doc_id])

  const filtered = chunks.filter(c =>
    !searchQuery || c.text.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const totalPages = Math.ceil(filtered.length / CHUNKS_PER_PAGE)
  const visible = filtered.slice(page * CHUNKS_PER_PAGE, (page + 1) * CHUNKS_PER_PAGE)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-ink-950 border border-ink-200 dark:border-ink-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink-200 dark:border-ink-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <FileText size={16} className="text-ink-400 shrink-0" />
            <div className="min-w-0">
              <h2 className="font-semibold text-sm text-ink-800 dark:text-ink-200 truncate">
                {doc.filename}
              </h2>
              <p className="text-xs text-ink-400">
                {doc.chunk_count} chunks · {doc.file_type.toUpperCase()}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-ink-100 dark:hover:bg-ink-800 rounded-lg text-ink-400 shrink-0">
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-ink-200 dark:border-ink-800">
          <div className="flex items-center gap-2 px-3 py-2 bg-ink-50 dark:bg-ink-900 rounded-lg border border-ink-200 dark:border-ink-700">
            <Search size={14} className="text-ink-400 shrink-0" />
            <input
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setPage(0) }}
              placeholder="Search within document..."
              className="flex-1 bg-transparent text-sm text-ink-700 dark:text-ink-300 placeholder-ink-400 outline-none"
            />
            {searchQuery && (
              <span className="text-xs text-ink-400">{filtered.length} results</span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading && (
            <div className="flex items-center justify-center h-32">
              <Loader size={24} className="animate-spin text-amber-400" />
            </div>
          )}
          {error && (
            <div className="text-sm text-red-500 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl">
              {error}
            </div>
          )}
          {!loading && visible.map((chunk, i) => (
            <div key={i} className="border border-ink-200 dark:border-ink-700 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 bg-ink-50 dark:bg-ink-900/50 border-b border-ink-200 dark:border-ink-700">
                <Hash size={12} className="text-ink-400" />
                <span className="text-xs font-mono text-ink-500">
                  Chunk {(page * CHUNKS_PER_PAGE) + i + 1}
                  {chunk.metadata?.page_number && ` · Page ${chunk.metadata.page_number}`}
                </span>
                <span className="ml-auto text-[10px] text-ink-400">
                  {chunk.text.length} chars
                </span>
              </div>
              <div className="p-3">
                <p className="text-xs font-mono text-ink-600 dark:text-ink-400 leading-relaxed whitespace-pre-wrap">
                  {chunk.text}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-ink-200 dark:border-ink-800">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="flex items-center gap-1 text-xs text-ink-500 hover:text-ink-700 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={14} /> Previous
            </button>
            <span className="text-xs text-ink-400">
              Page {page + 1} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="flex items-center gap-1 text-xs text-ink-500 hover:text-ink-700 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
