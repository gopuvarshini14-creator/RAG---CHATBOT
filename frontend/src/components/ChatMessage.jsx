/**
 * ChatMessage Component
 * Renders a single chat message with markdown and source citations
 */

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useState } from 'react'
import { ChevronDown, ChevronRight, FileText, Hash } from 'lucide-react'

function SourceCard({ source, index }) {
  const [open, setOpen] = useState(false)
  const pct = Math.round(source.score * 100)

  return (
    <div className="border border-ink-200 dark:border-ink-700 rounded-lg overflow-hidden text-xs">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-ink-50 dark:bg-ink-900/50 hover:bg-ink-100 dark:hover:bg-ink-800/50 transition-colors text-left"
      >
        <FileText size={11} className="text-ink-400 shrink-0" />
        <span className="flex-1 text-ink-600 dark:text-ink-400 truncate font-medium">
          {source.filename}
        </span>
        {source.page_number && (
          <span className="flex items-center gap-0.5 text-ink-400 shrink-0">
            <Hash size={9} />p.{source.page_number}
          </span>
        )}
        <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
          pct >= 80 ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
          : pct >= 60 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
          : 'bg-ink-100 text-ink-500'
        }`}>
          {pct}%
        </span>
        {open ? <ChevronDown size={12} className="text-ink-400 shrink-0" /> : <ChevronRight size={12} className="text-ink-400 shrink-0" />}
      </button>

      {open && (
        <div className="px-3 py-2 bg-white dark:bg-ink-900 border-t border-ink-200 dark:border-ink-700">
          <p className="text-ink-600 dark:text-ink-400 leading-relaxed font-mono text-[11px]">
            {source.content}
          </p>
        </div>
      )}
    </div>
  )
}

export default function ChatMessage({ message }) {
  const isUser = message.role === 'user'
  const [sourcesOpen, setSourcesOpen] = useState(false)

  return (
    <div className={`flex gap-3 animate-slide-up ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div className={`
        shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold
        ${isUser
          ? 'bg-ink-900 dark:bg-amber-500 text-white dark:text-ink-950'
          : 'bg-amber-400 text-ink-950'
        }
      `}>
        {isUser ? 'U' : 'AI'}
      </div>

      {/* Content */}
      <div className={`flex-1 max-w-[85%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-2`}>
        {/* Message bubble */}
        <div className={`
          px-5 py-3 text-sm leading-relaxed
          ${isUser
            ? 'bg-ink-900 dark:bg-ink-800 text-white rounded-3xl rounded-tr-sm ml-auto shadow-sm'
            : 'bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 text-ink-800 dark:text-ink-200 rounded-2xl rounded-tl-sm shadow-sm'
          }
        `}>
          {isUser ? (
            <p>{message.content}</p>
          ) : (
            <div className="prose-doc">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Sources section */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="w-full space-y-1">
            <button
              onClick={() => setSourcesOpen(!sourcesOpen)}
              className="flex items-center gap-1.5 text-xs text-ink-400 hover:text-ink-600 dark:hover:text-ink-300 transition-colors"
            >
              {sourcesOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <span>{message.sources.length} source{message.sources.length !== 1 ? 's' : ''} referenced</span>
            </button>

            {sourcesOpen && (
              <div className="space-y-1.5 animate-fade-in">
                {message.sources.map((src, i) => (
                  <SourceCard key={i} source={src} index={i + 1} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Timestamp */}
        <span className="text-[10px] text-ink-400 px-1">
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  )
}
