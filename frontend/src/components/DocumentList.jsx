/**
 * DocumentList Component
 * Shows uploaded documents with status, selection, deletion, and summarization
 */

import { useState } from 'react'
import {
  FileText, Trash2, CheckSquare, Square, Loader,
  AlertCircle, BookOpen, ChevronDown, ChevronRight, Sparkles
} from 'lucide-react'
import { documentsApi } from '../services/api'
import { useStore } from '../store/useStore'

const STATUS_BADGE = {
  ready: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  processing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / 1024 ** 2).toFixed(1)}MB`
}

function DocumentItem({ doc, isSelected, onToggle, onDelete, onSummarize }) {
  const [expanded, setExpanded] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async (e) => {
    e.stopPropagation()
    if (!confirm(`Delete "${doc.filename}"?`)) return
    setDeleting(true)
    try {
      await onDelete(doc.doc_id)
    } finally {
      setDeleting(false)
    }
  }

  const isReady = doc.status === 'ready'

  return (
    <div className={`
      rounded-xl border transition-all duration-200 animate-slide-in-right
      ${isSelected
        ? 'border-amber-400 bg-amber-50/50 dark:bg-amber-950/20'
        : 'border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900/30'
      }
    `}>
      {/* Main row */}
      <div className="flex items-center gap-2 p-3">
        {/* Selection checkbox */}
        <button
          onClick={() => isReady && onToggle(doc.doc_id)}
          className={`shrink-0 transition-colors ${isReady ? 'text-amber-500 hover:text-amber-600' : 'text-ink-300 cursor-default'}`}
          disabled={!isReady}
          title={isReady ? 'Toggle selection' : 'Still processing'}
        >
          {isSelected
            ? <CheckSquare size={16} />
            : <Square size={16} />
          }
        </button>

        {/* File icon */}
        <div className="shrink-0 text-ink-400">
          <FileText size={15} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-ink-800 dark:text-ink-200 truncate">
            {doc.filename}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_BADGE[doc.status]}`}>
              {doc.status === 'processing'
                ? <span className="flex items-center gap-1"><Loader size={9} className="animate-spin" /> Processing</span>
                : doc.status
              }
            </span>
            <span className="text-[10px] text-ink-400">
              {formatSize(doc.file_size)}
              {doc.chunk_count > 0 && ` · ${doc.chunk_count} chunks`}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {isReady && (
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}
              className="p-1 hover:bg-ink-100 dark:hover:bg-ink-800 rounded-lg transition-colors text-ink-400"
              title="Summarize options"
            >
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-ink-400 hover:text-red-500"
            title="Delete document"
          >
            {deleting ? <Loader size={14} className="animate-spin" /> : <Trash2 size={14} />}
          </button>
        </div>
      </div>

      {/* Expandable summary options */}
      {expanded && isReady && (
        <div className="px-3 pb-3 space-y-1.5 border-t border-ink-100 dark:border-ink-800 pt-2">
          <p className="text-[10px] font-medium text-ink-400 uppercase tracking-wider mb-2">Summarize</p>
          {['concise', 'detailed', 'bullets'].map((type) => (
            <button
              key={type}
              onClick={() => onSummarize(doc.doc_id, type)}
              className="w-full text-left text-xs px-2.5 py-1.5 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-600 dark:text-ink-400 flex items-center gap-2 transition-colors"
            >
              <Sparkles size={11} className="text-amber-400" />
              {type.charAt(0).toUpperCase() + type.slice(1)} summary
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function DocumentList({ onSummarize }) {
  const { documents, selectedDocIds, toggleDocSelection, selectAllDocs, clearDocSelection, removeDocument } = useStore()

  const handleDelete = async (docId) => {
    await documentsApi.delete(docId)
    removeDocument(docId)
  }

  const readyDocs = documents.filter(d => d.status === 'ready')
  const allSelected = readyDocs.length > 0 && readyDocs.every(d => selectedDocIds.includes(d.doc_id))

  if (documents.length === 0) {
    return (
      <div className="text-center py-8 text-ink-400">
        <BookOpen size={24} className="mx-auto mb-2 opacity-30" />
        <p className="text-xs">No documents yet</p>
        <p className="text-xs opacity-70">Upload files above to get started</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Selection controls */}
      {readyDocs.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-ink-500">
            {selectedDocIds.length === 0
              ? 'Select docs to filter Q&A'
              : `${selectedDocIds.length} selected`
            }
          </p>
          <div className="flex gap-1">
            <button onClick={allSelected ? clearDocSelection : selectAllDocs} className="btn-ghost text-xs py-1">
              {allSelected ? 'None' : 'All'}
            </button>
          </div>
        </div>
      )}

      {/* Document list */}
      <div className="space-y-2">
        {documents.map(doc => (
          <DocumentItem
            key={doc.doc_id}
            doc={doc}
            isSelected={selectedDocIds.includes(doc.doc_id)}
            onToggle={toggleDocSelection}
            onDelete={handleDelete}
            onSummarize={onSummarize}
          />
        ))}
      </div>
    </div>
  )
}
