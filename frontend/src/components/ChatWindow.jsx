/**
 * ChatWindow Component
 * Main chat interface with message history and input
 */

import { useState, useRef, useEffect } from 'react'
import { Send, Trash2, Loader, Zap } from 'lucide-react'
import ChatMessage from './ChatMessage'
import { useStore } from '../store/useStore'
import { chatApi } from '../services/api'

function TypingIndicator() {
  return (
    <div className="flex gap-3 animate-fade-in">
      <div className="w-7 h-7 rounded-lg bg-amber-400 flex items-center justify-center text-sm font-bold text-ink-950 shrink-0">
        AI
      </div>
      <div className="bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 rounded-2xl rounded-tl-sm px-4 py-3">
        <div className="flex gap-1.5 items-center h-4">
          <div className="w-1.5 h-1.5 rounded-full bg-ink-400 typing-dot" />
          <div className="w-1.5 h-1.5 rounded-full bg-ink-400 typing-dot" />
          <div className="w-1.5 h-1.5 rounded-full bg-ink-400 typing-dot" />
        </div>
      </div>
    </div>
  )
}

const STARTER_QUESTIONS = [
  'What is this document about?',
  'Summarize the key findings',
  'What are the main conclusions?',
  'List the most important points',
]

export default function ChatWindow() {
  const [input, setInput] = useState('')
  const [useStreaming, setUseStreaming] = useState(true)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  const {
    messages, addMessage, updateLastMessage, clearMessages,
    isStreaming, setStreaming,
    streamingContent, setStreamingContent, appendStreamingContent,
    selectedDocIds, documents,
  } = useStore()

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  const readyDocs = documents.filter(d => d.status === 'ready')
  const canChat = readyDocs.length > 0 && !isStreaming

  // Build chat history in the format the API expects
  const getChatHistory = () =>
    messages.slice(-10).map(m => ({ role: m.role, content: m.content }))

  const sendMessage = async (question) => {
    if (!question.trim() || !canChat) return

    const userMsg = {
      role: 'user',
      content: question.trim(),
      timestamp: new Date().toISOString(),
    }
    addMessage(userMsg)
    setInput('')
    setStreaming(true)

    const docIds = selectedDocIds.length > 0 ? selectedDocIds : null
    const history = getChatHistory()

    try {
      if (useStreaming) {
        // ─── Streaming mode ───────────────────────────────────
        setStreamingContent('')

        // Add placeholder message
        addMessage({
          role: 'assistant',
          content: '',
          sources: [],
          timestamp: new Date().toISOString(),
        })

        let fullContent = ''
        let sources = []

        for await (const event of chatApi.askStream(question.trim(), docIds, history)) {
          if (event.type === 'token') {
            fullContent += event.content
            setStreamingContent(fullContent)
            updateLastMessage({ content: fullContent })
          } else if (event.type === 'sources') {
            sources = event.sources
          } else if (event.type === 'done') {
            updateLastMessage({ content: fullContent, sources })
            setStreamingContent('')
            break
          } else if (event.type === 'error') {
            throw new Error(event.message)
          }
        }

      } else {
        // ─── Non-streaming mode ───────────────────────────────
        const data = await chatApi.ask(question.trim(), docIds, history)
        addMessage({
          role: 'assistant',
          content: data.answer,
          sources: data.sources || [],
          timestamp: new Date().toISOString(),
        })
      }

    } catch (err) {
      addMessage({
        role: 'assistant',
        content: `⚠️ **Error:** ${err.message || 'Something went wrong. Check that your API key is configured.'}`,
        sources: [],
        timestamp: new Date().toISOString(),
      })
    } finally {
      setStreaming(false)
      setStreamingContent('')
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-ink-200 dark:border-ink-800">
        <div>
          <h2 className="text-sm font-semibold text-ink-800 dark:text-ink-200">
            Document Chat
          </h2>
          <p className="text-xs text-ink-400">
            {selectedDocIds.length > 0
              ? `Searching ${selectedDocIds.length} selected document${selectedDocIds.length !== 1 ? 's' : ''}`
              : `Searching all ${readyDocs.length} document${readyDocs.length !== 1 ? 's' : ''}`
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Streaming toggle */}
          <button
            onClick={() => setUseStreaming(!useStreaming)}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors ${
              useStreaming
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                : 'bg-ink-100 text-ink-500 dark:bg-ink-800'
            }`}
            title="Toggle streaming responses"
          >
            <Zap size={11} />
            Stream
          </button>

          {messages.length > 0 && (
            <button
              onClick={clearMessages}
              className="btn-ghost flex items-center gap-1.5 text-xs"
              title="Clear chat"
            >
              <Trash2 size={13} />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          /* Empty state with starter questions */
          <div className="h-full flex flex-col items-center justify-center gap-6 py-12">
            <div className="text-center">
              <div className="w-14 h-14 bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">💬</span>
              </div>
              <h3 className="font-display text-lg font-bold text-ink-800 dark:text-ink-200">
                Ask anything
              </h3>
              <p className="text-sm text-ink-400 mt-1">
                {readyDocs.length === 0
                  ? 'Upload documents to start asking questions'
                  : 'Your documents are ready. Try a question below.'
                }
              </p>
            </div>

            {readyDocs.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                {STARTER_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="text-left text-xs p-3 rounded-xl border border-ink-200 dark:border-ink-700 hover:border-amber-300 dark:hover:border-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-all text-ink-600 dark:text-ink-400"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Message list */
          <>
            {messages.map(msg => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            {isStreaming && messages[messages.length - 1]?.role !== 'assistant' && (
              <TypingIndicator />
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="p-4 border-t border-ink-200 dark:border-ink-800">
        <div className={`
          flex items-end gap-2 p-2 rounded-xl border-2 transition-colors
          ${canChat
            ? 'border-ink-200 dark:border-ink-700 focus-within:border-amber-400 dark:focus-within:border-amber-500 bg-white dark:bg-ink-900'
            : 'border-ink-100 dark:border-ink-800 bg-ink-50 dark:bg-ink-900/50'
          }
        `}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              readyDocs.length === 0
                ? 'Upload a document to start chatting...'
                : 'Ask a question about your documents...'
            }
            disabled={!canChat}
            rows={1}
            className="flex-1 bg-transparent text-sm text-ink-800 dark:text-ink-200 placeholder-ink-400 outline-none resize-none max-h-32 py-1.5 px-2"
            style={{ fieldSizing: 'content' }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!canChat || !input.trim()}
            className="shrink-0 p-2 rounded-lg bg-ink-900 dark:bg-amber-500 text-white dark:text-ink-950 hover:bg-ink-700 dark:hover:bg-amber-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            {isStreaming
              ? <Loader size={16} className="animate-spin" />
              : <Send size={16} />
            }
          </button>
        </div>
        <p className="text-[10px] text-ink-400 mt-1.5 text-center">
          Enter to send · Shift+Enter for newline
        </p>
      </div>
    </div>
  )
}
