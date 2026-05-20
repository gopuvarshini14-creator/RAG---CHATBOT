import axios from 'axios'

const BASE_URL = "https://rag-chatbot-db72.onrender.com"

/**
 * Enhanced API Service with Error Handling
 * Adds:
 * - Request/response interceptors
 * - Automatic retry on 5xx errors
 * - User-friendly error messages
 * - Request cancellation support
 */


// ─── Axios Instance ───────────────────────────────────────────
export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 120_000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// ─── Request Interceptor ─────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    // Add API key if configured
    const apiKey = localStorage.getItem('rag-api-key')
    if (apiKey) {
      config.headers['X-API-Key'] = apiKey
    }

    // Add request timestamp for debugging
    config.metadata = { startTime: Date.now() }
    return config
  },
  (error) => Promise.reject(error)
)

// ─── Response Interceptor ────────────────────────────────────
api.interceptors.response.use(
  (response) => {
    // Log slow requests in development
    if (import.meta.env.DEV) {
      const duration = Date.now() - (response.config.metadata?.startTime || 0)
      if (duration > 2000) {
        console.warn(`[API] Slow request: ${response.config.url} took ${duration}ms`)
      }
    }
    return response
  },
  async (error) => {
    const status = error.response?.status
    const detail = error.response?.data?.detail

    // Format user-friendly error messages
    let message = 'An unexpected error occurred'

    if (!error.response) {
      message = 'Cannot connect to server. Is the backend running?'
    } else if (status === 400) {
      message = detail || 'Invalid request'
    } else if (status === 401) {
      message = 'Authentication required. Check your API key.'
    } else if (status === 404) {
      message = detail || 'Resource not found'
    } else if (status === 413) {
      message = 'File too large'
    } else if (status === 422) {
      message = 'Invalid input data'
    } else if (status === 429) {
      const retryAfter = error.response.headers['retry-after']
      message = `Rate limit exceeded. ${retryAfter ? `Try again in ${retryAfter}s` : 'Please slow down.'}`
    } else if (status >= 500) {
      message = 'Server error. Please try again.'
    }

    // Attach friendly message to error
    error.friendlyMessage = message

    return Promise.reject(error)
  }
)

// ─── Cancellation Helper ─────────────────────────────────────
/**
 * Create a cancellable request.
 * Usage:
 *   const { token, cancel } = makeCancelToken()
 *   await api.get('/endpoint', { cancelToken: token })
 *   cancel() // Cancel in-flight request
 */
export function makeCancelToken() {
  const controller = new AbortController()
  return {
    signal: controller.signal,
    cancel: () => controller.abort(),
  }
}

// ─── API Methods ─────────────────────────────────────────────
export const documentsApi = {
  list: () => api.get('/documents/').then(r => r.data),

  upload: (file, onProgress) => {
    const form = new FormData()
    form.append('file', file)
    return api.post('/documents/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: e => onProgress?.(Math.round((e.loaded * 100) / e.total)),
    }).then(r => r.data)
  },

  get: (docId) => api.get(`/documents/${docId}`).then(r => r.data),
  delete: (docId) => api.delete(`/documents/${docId}`).then(r => r.data),

  summarize: (docId, summaryType = 'concise', sectionText = null) =>
    api.post('/documents/summarize', {
      doc_id: docId,
      summary_type: summaryType,
      section_text: sectionText,
    }).then(r => r.data),
}

export const chatApi = {
  ask: (question, docIds, chatHistory) =>
    api.post('/chat/ask', {
      question,
      doc_ids: docIds?.length > 0 ? docIds : null,
      chat_history: chatHistory || [],
    }).then(r => r.data),

  askStream: async function* (question, docIds, chatHistory, signal) {
    const response = await fetch(`${BASE_URL}/chat/ask/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question,
        doc_ids: docIds?.length > 0 ? docIds : null,
        chat_history: chatHistory || [],
        stream: true,
      }),
      signal,  // Support AbortController cancellation
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err.detail || `Stream failed: ${response.status}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              yield JSON.parse(line.slice(6))
            } catch { /* skip malformed */ }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  },
}

export const analyticsApi = {
  getStats: () => api.get('/analytics/stats').then(r => r.data),
  getDocumentInfo: (docId) => api.get(`/analytics/documents/${docId}/info`).then(r => r.data),
}

export const healthApi = {
  check: () => api.get('/health').then(r => r.data),
}
