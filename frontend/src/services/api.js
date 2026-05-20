import axios from "axios"

const BASE_URL = "https://rag-chatbot-db72.onrender.com"

// Axios instance
export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 120000,
  headers: {
    "Content-Type": "application/json",
  },
})

// DOCUMENTS API
export const documentsApi = {
  list: () => api.get("/api/documents/").then(r => r.data),

  upload: (file, onProgress) => {
    const form = new FormData()
    form.append("file", file)

    return api.post("/api/documents/upload", form, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      onUploadProgress: (e) =>
        onProgress?.(Math.round((e.loaded * 100) / e.total)),
    }).then(r => r.data)
  },

  get: (docId) =>
    api.get(`/api/documents/${docId}`).then(r => r.data),

  delete: (docId) =>
    api.delete(`/api/documents/${docId}`).then(r => r.data),

  summarize: (docId, summaryType = "concise", sectionText = null) =>
    api.post("/api/documents/summarize", {
      doc_id: docId,
      summary_type: summaryType,
      section_text: sectionText,
    }).then(r => r.data),
}

// CHAT API
export const chatApi = {
  ask: (question, docIds, chatHistory) =>
    api.post("/api/chat/ask", {
      question,
      doc_ids: docIds?.length ? docIds : null,
      chat_history: chatHistory || [],
    }).then(r => r.data),
}

// HEALTH CHECK
export const healthApi = {
  check: () => api.get("/api/health").then(r => r.data),
}
