/**
 * useChat Hook
 * Encapsulates chat send logic, streaming, and history management.
 *
 * Usage:
 *   const { send, isLoading, error } = useChat()
 *   await send("What is this document about?")
 */

import { useCallback } from 'react'
import { chatApi } from '../services/api'
import { useStore } from '../store/useStore'

export function useChat() {
  const {
    messages,
    addMessage,
    updateLastMessage,
    setStreaming,
    setStreamingContent,
    appendStreamingContent,
    isStreaming,
    selectedDocIds,
  } = useStore()

  // Build history in API format (last N turns)
  const buildHistory = useCallback(() => {
    return messages.slice(-12).map(m => ({
      role: m.role,
      content: m.content,
    }))
  }, [messages])

  const send = useCallback(async (question, { stream = true } = {}) => {
    if (!question.trim() || isStreaming) return

    const userTimestamp = new Date().toISOString()
    addMessage({ role: 'user', content: question.trim(), timestamp: userTimestamp })

    const docIds = selectedDocIds.length > 0 ? selectedDocIds : null
    const history = buildHistory()

    setStreaming(true)

    try {
      if (stream) {
        // ── Streaming path ──────────────────────────────────
        setStreamingContent('')
        addMessage({
          role: 'assistant',
          content: '',
          sources: [],
          timestamp: new Date().toISOString(),
        })

        let fullContent = ''
        let sources = []

        for await (const event of chatApi.askStream(question.trim(), docIds, history)) {
          switch (event.type) {
            case 'token':
              fullContent += event.content
              setStreamingContent(fullContent)
              updateLastMessage({ content: fullContent })
              break
            case 'sources':
              sources = event.sources || []
              break
            case 'done':
              updateLastMessage({ content: fullContent, sources })
              setStreamingContent('')
              return { answer: fullContent, sources }
            case 'error':
              throw new Error(event.message)
          }
        }

      } else {
        // ── Non-streaming path ──────────────────────────────
        const data = await chatApi.ask(question.trim(), docIds, history)
        addMessage({
          role: 'assistant',
          content: data.answer,
          sources: data.sources || [],
          timestamp: new Date().toISOString(),
        })
        return data
      }

    } catch (err) {
      const errorMsg = err.message || 'Something went wrong'
      addMessage({
        role: 'assistant',
        content: `⚠️ **Error:** ${errorMsg}`,
        sources: [],
        timestamp: new Date().toISOString(),
      })
      throw err

    } finally {
      setStreaming(false)
      setStreamingContent('')
    }
  }, [
    isStreaming, selectedDocIds, buildHistory,
    addMessage, updateLastMessage, setStreaming,
    setStreamingContent,
  ])

  return { send, isStreaming }
}
