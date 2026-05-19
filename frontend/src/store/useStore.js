/**
 * Global State Store (Zustand)
 * Manages documents, chat history, and UI state
 */

import { create } from 'zustand'

export const useStore = create((set, get) => ({
  // ─── Documents ─────────────────────────────────────────────
  documents: [],
  selectedDocIds: [],   // Which docs to query (empty = all)

  setDocuments: (docs) => set({ documents: docs }),

  addDocument: (doc) => set((state) => ({
    documents: [doc, ...state.documents]
  })),

  updateDocument: (docId, updates) => set((state) => ({
    documents: state.documents.map(d =>
      d.doc_id === docId ? { ...d, ...updates } : d
    )
  })),

  removeDocument: (docId) => set((state) => ({
    documents: state.documents.filter(d => d.doc_id !== docId),
    selectedDocIds: state.selectedDocIds.filter(id => id !== docId),
  })),

  toggleDocSelection: (docId) => set((state) => ({
    selectedDocIds: state.selectedDocIds.includes(docId)
      ? state.selectedDocIds.filter(id => id !== docId)
      : [...state.selectedDocIds, docId]
  })),

  selectAllDocs: () => set((state) => ({
    selectedDocIds: state.documents
      .filter(d => d.status === 'ready')
      .map(d => d.doc_id)
  })),

  clearDocSelection: () => set({ selectedDocIds: [] }),

  // ─── Chat ──────────────────────────────────────────────────
  messages: [],         // [{id, role, content, sources, timestamp}]
  isStreaming: false,
  streamingContent: '',

  addMessage: (message) => set((state) => ({
    messages: [...state.messages, { id: Date.now(), ...message }]
  })),

  updateLastMessage: (updates) => set((state) => {
    const msgs = [...state.messages]
    if (msgs.length > 0) {
      msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], ...updates }
    }
    return { messages: msgs }
  }),

  clearMessages: () => set({ messages: [], streamingContent: '' }),

  setStreaming: (val) => set({ isStreaming: val }),
  setStreamingContent: (content) => set({ streamingContent: content }),
  appendStreamingContent: (chunk) => set((state) => ({
    streamingContent: state.streamingContent + chunk
  })),

  // ─── UI ────────────────────────────────────────────────────
  sidebarOpen: true,
  darkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,
  activePanel: 'chat',  // 'chat' | 'summary'

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  toggleDarkMode: () => set((state) => {
    const next = !state.darkMode
    document.documentElement.classList.toggle('dark', next)
    return { darkMode: next }
  }),
  setActivePanel: (panel) => set({ activePanel: panel }),
}))
