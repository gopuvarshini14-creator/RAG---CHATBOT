/**
 * RAG API Service (PRODUCTION SAFE FIXED VERSION)
 */

import axios from 'axios'

// 🔥 ONLY BACKEND URL (Render)
const BASE_URL = "https://rag-chatbot-db72.onrender.com"

// ─── Axios Instance ───────────────────────────────────────────
export const api = axios.create({
  timeout: 120000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// ─── Request Interceptor ─────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const apiKey = localStorage.getItem('rag-api-key')
    if (apiKey) {
      config.headers['X-API-Key'] = apiKey
    }

    config.metadata = { startTime: Date.now() }
    return config
  },
  (error) => Promise.reject(error)
)

// ─── Response Interceptor ────────────────────────────────────
api.interceptors.response.use(
  (response) => {
    const duration = Date.now() - (response.config.metadata?.startTime || 0)
    if (import.meta.env.DEV && duration > 2000) {
      console.warn(`[API] Slow request: ${response.config.url} took ${duration}ms`)
    }
    return response
  },
  (error) => {
    error.friendlyMessage =
      error.response?.data?.detail ||
      "Server error. Please try again."

    return Promise.reject(error)
  }
)

// ─── Helpers ──────────────────────────────────────────────────
export function makeCancelToken() {
  const controller = new AbortController()
  return {
    signal: controller.signal,
    cancel: () => controller.abort(),
  }
}

// ─── DOCUMENTS API ───────────────────────────────────────────
export const documentsApi = {
  list: () =>
    api.get(`${BASE_URL}/api/documents/`).then(r => r.data),

  upload: (file, onProgress) => {
    const form = new FormData()
    form.append('file', file)

    return api.post(`${BASE_URL}/api/documents/upload`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) =>
        onProgress?.(Math.round((e.loaded * 100) / e.total)),
    }).then(r => r.data)
  },

  get: (docId) =>
    api.get(`${BASE_URL}/api/documents/${docId}`).then(r => r.data),

  delete: (docId) =>
    api.delete(`${BASE_URL}/api/documents/${docId}`).then(r => r.data),

  summarize: (docId, summaryType = "concise", sectionText = null) =>
    api.post(`${BASE_URL}/api/documents/summarize`, {
      doc_id: docId,
      summary_type: summaryType,
      section_text: sectionText,
    }).then(r => r.data),
}

// ─── CHAT API ────────────────────────────────────────────────
export const chatApi = {
  ask: (question, docIds, chatHistory) =>
    api.post(`${BASE_URL}/api/chat/ask`, {
      question,
      doc_ids: docIds?.length ? docIds : null,
      chat_history: chatHistory || [],
    }).then(r => r.data),

  askStream: async function* (question, docIds, chatHistory, signal) {
    const response = await fetch(`${BASE_URL}/api/chat/ask/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        doc_ids: docIds?.length ? docIds : null,
        chat_history: chatHistory || [],
        stream: true,
      }),
      signal,
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err.detail || `Stream failed: ${response.status}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop()

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              yield JSON.parse(line.slice(6))
            } catch {}
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  },
}

// ─── ANALYTICS ───────────────────────────────────────────────
export const analyticsApi = {
  getStats: () =>
    api.get(`${BASE_URL}/api/analytics/stats`).then(r => r.data),

  getDocumentInfo: (docId) =>
    api.get(`${BASE_URL}/api/analytics/documents/${docId}/info`).then(r => r.data),
}

// ─── HEALTH CHECK ────────────────────────────────────────────
export const healthApi = {
  check: () =>
    api.get(`${BASE_URL}/api/health`).then(r => r.data),
}
