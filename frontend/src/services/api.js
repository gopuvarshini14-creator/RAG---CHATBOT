import axios from "axios"

const BASE_URL = "https://rag-chatbot-db72.onrender.com"

// FORCE ALL REQUESTS TO RENDER
export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 120000,
  headers: {
    "Content-Type": "application/json",
  },
})

// Documents
export const documentsApi = {
  list: () => api.get("/api/documents/").then(r => r.data),

  upload: (file, onProgress) => {
    const form = new FormData()
    form.append("file", file)

    return api.post("/api/documents/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) =>
        onProgress?.(Math.round((e.loaded * 100) / e.total)),
    }).then(r => r.data)
  },

  get: (id) => api.get(`/api/documents/${id}`).then(r => r.data),

  delete: (id) => api.delete(`/api/documents/${id}`).then(r => r.data),
}

// Chat
export const chatApi = {
  ask: (question, docIds, chatHistory) =>
    api.post("/api/chat/ask", {
      question,
      doc_ids: docIds?.length ? docIds : null,
      chat_history: chatHistory || [],
    }).then(r => r.data),
}

// Health
export const healthApi = {
  check: () => api.get("/api/health").then(r => r.data),
}
