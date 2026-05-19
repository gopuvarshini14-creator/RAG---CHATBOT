/**
 * Chat Export Utilities
 * Export the chat history as Markdown, JSON, or plain text.
 */

/**
 * Export messages as a Markdown document.
 * Includes sources and timestamps.
 *
 * @param {Array} messages - Array of ChatMessage objects
 * @param {string} title - Document title
 * @returns {string} Markdown string
 */
export function exportAsMarkdown(messages, title = 'Chat Export') {
  const now = new Date().toLocaleString()
  const lines = [
    `# ${title}`,
    `*Exported on ${now}*`,
    `*${messages.length} messages*`,
    '',
    '---',
    '',
  ]

  for (const msg of messages) {
    const time = new Date(msg.timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })

    if (msg.role === 'user') {
      lines.push(`## 👤 User *(${time})*`)
      lines.push('')
      lines.push(msg.content)
      lines.push('')
    } else {
      lines.push(`## 🤖 Assistant *(${time})*`)
      lines.push('')
      lines.push(msg.content)
      lines.push('')

      // Include sources if present
      if (msg.sources && msg.sources.length > 0) {
        lines.push('**Sources:**')
        msg.sources.forEach((src, i) => {
          const page = src.page_number ? ` (page ${src.page_number})` : ''
          const score = Math.round(src.score * 100)
          lines.push(`${i + 1}. *${src.filename}${page}* — ${score}% relevance`)
          lines.push(`   > ${src.content.slice(0, 150)}...`)
        })
        lines.push('')
      }
    }

    lines.push('---')
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * Export messages as structured JSON.
 * Useful for programmatic processing or re-importing.
 *
 * @param {Array} messages - Array of ChatMessage objects
 * @returns {string} JSON string
 */
export function exportAsJSON(messages) {
  return JSON.stringify({
    exported_at: new Date().toISOString(),
    version: '1.0',
    message_count: messages.length,
    messages: messages.map(m => ({
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
      sources: m.sources || [],
    })),
  }, null, 2)
}

/**
 * Export messages as plain text Q&A pairs.
 *
 * @param {Array} messages - Array of ChatMessage objects
 * @returns {string} Plain text
 */
export function exportAsText(messages) {
  const pairs = []
  let currentQ = null

  for (const msg of messages) {
    if (msg.role === 'user') {
      currentQ = msg.content
    } else if (msg.role === 'assistant' && currentQ) {
      pairs.push(`Q: ${currentQ}\n\nA: ${msg.content}`)
      currentQ = null
    }
  }

  return pairs.join('\n\n' + '='.repeat(60) + '\n\n')
}

/**
 * Trigger a file download in the browser.
 *
 * @param {string} content - File content
 * @param {string} filename - Download filename
 * @param {string} mimeType - MIME type
 */
export function downloadFile(content, filename, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * ExportButton component — use in ChatWindow header.
 */
import { Download } from 'lucide-react'
import { useState } from 'react'

export function ExportButton({ messages }) {
  const [open, setOpen] = useState(false)

  const handle = (format) => {
    const ts = new Date().toISOString().slice(0, 10)
    setOpen(false)

    if (format === 'md') {
      downloadFile(exportAsMarkdown(messages), `chat-${ts}.md`, 'text/markdown')
    } else if (format === 'json') {
      downloadFile(exportAsJSON(messages), `chat-${ts}.json`, 'application/json')
    } else if (format === 'txt') {
      downloadFile(exportAsText(messages), `chat-${ts}.txt`, 'text/plain')
    }
  }

  if (messages.length === 0) return null

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-ink-400 hover:text-ink-600 dark:hover:text-ink-300 px-2 py-1.5 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors"
        title="Export chat"
      >
        <Download size={13} />
        Export
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 rounded-xl shadow-lg overflow-hidden min-w-[140px]">
            {[
              { key: 'md', label: 'Markdown (.md)' },
              { key: 'json', label: 'JSON (.json)' },
              { key: 'txt', label: 'Plain Text (.txt)' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => handle(key)}
                className="w-full text-left text-xs px-3 py-2.5 hover:bg-ink-50 dark:hover:bg-ink-800 text-ink-600 dark:text-ink-400 transition-colors"
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
