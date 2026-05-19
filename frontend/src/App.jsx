/**
 * App.jsx — Root layout (Complete Production Version)
 * Integrates: Toast, Settings, Keyboard Shortcuts, Export, Dark Mode
 */

import { useEffect, useState, useRef } from 'react'
import {
  Moon, Sun, PanelLeft, MessageSquare, Sparkles,
  BookOpen, AlertCircle, RefreshCw, Settings, Keyboard
} from 'lucide-react'

import FileUploader from './components/FileUploader'
import DocumentList from './components/DocumentList'
import ChatWindow from './components/ChatWindow'
import SummaryPanel from './components/SummaryPanel'
import SettingsPanel from './components/SettingsPanel'
import EmptyState from './components/EmptyState'
import { ToastProvider } from './components/Toast'
import { ShortcutsModal, useKeyboardShortcuts } from './components/KeyboardShortcuts'

import { useStore } from './store/useStore'
import { documentsApi, healthApi } from './services/api'

export default function App() {
  const {
    documents, setDocuments,
    sidebarOpen, toggleSidebar,
    darkMode, toggleDarkMode,
    activePanel, setActivePanel,
  } = useStore()

  const [apiStatus, setApiStatus] = useState('checking')
  const [summaryTarget, setSummaryTarget] = useState(null)
  const [showSettings, setShowSettings] = useState(false)

  const chatInputRef = useRef(null)
  const fileInputRef = useRef(null)

  const { showShortcuts, setShowShortcuts } = useKeyboardShortcuts({
    chatInputRef, fileInputRef,
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  useEffect(() => {
    async function init() {
      try {
        await healthApi.check()
        setApiStatus('ok')
        const data = await documentsApi.list()
        setDocuments(data.documents || [])
      } catch {
        setApiStatus('error')
      }
    }
    init()
  }, [setDocuments])

  useEffect(() => {
    const processing = documents.some(d => d.status === 'processing')
    if (!processing) return
    const id = setInterval(async () => {
      try {
        const data = await documentsApi.list()
        setDocuments(data.documents || [])
      } catch {}
    }, 5000)
    return () => clearInterval(id)
  }, [documents, setDocuments])

  const handleSummarize = (docId, type) => {
    setSummaryTarget({ docId, type })
    setActivePanel('summary')
  }

  const handleUploadComplete = async () => {
    try {
      const data = await documentsApi.list()
      setDocuments(data.documents || [])
    } catch {}
  }

  const readyDocs = documents.filter(d => d.status === 'ready')

  return (
    <ToastProvider>
      <div className="flex h-screen overflow-hidden bg-[var(--bg)]">

        {/* Sidebar */}
        <aside className={`
          flex flex-col border-r border-ink-200 dark:border-ink-800
          bg-white dark:bg-ink-950/50 transition-all duration-300 shrink-0
          ${sidebarOpen ? 'w-72' : 'w-0 overflow-hidden'}
        `}>
          <div className="flex items-center gap-2.5 px-4 py-4 border-b border-ink-200 dark:border-ink-800">
            <div className="w-7 h-7 bg-amber-400 rounded-lg flex items-center justify-center shrink-0">
              <BookOpen size={14} className="text-ink-950" />
            </div>
            <div>
              <h1 className="font-display text-base font-bold tracking-tight text-ink-900 dark:text-ink-100">DocMind</h1>
              <p className="text-[10px] text-ink-400 leading-none">AI Document Q&A</p>
            </div>
          </div>

          {apiStatus === 'error' && (
            <div className="mx-3 mt-3 p-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 font-medium">
                <AlertCircle size={12} />Backend offline
              </div>
              <p className="text-[10px] text-red-500 mt-1">Run: <code className="font-mono">uvicorn main:app --reload</code></p>
              <button onClick={() => window.location.reload()} className="mt-1.5 flex items-center gap-1 text-[10px] text-red-500 hover:text-red-700">
                <RefreshCw size={10} /> Retry
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-3 space-y-5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-400 mb-2.5 px-1">Upload Documents</p>
              <input ref={fileInputRef} type="file" className="hidden" multiple accept=".pdf,.docx,.txt" />
              <FileUploader onUploadComplete={handleUploadComplete} />
            </div>
            {documents.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-400 mb-2.5 px-1">Documents ({documents.length})</p>
                <DocumentList onSummarize={handleSummarize} />
              </div>
            )}
          </div>

          <div className="p-3 border-t border-ink-200 dark:border-ink-800">
            <p className="text-[10px] text-ink-400 text-center">Powered by OpenAI · ChromaDB</p>
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="flex items-center justify-between px-4 py-3 border-b border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-950/30 shrink-0">
            <div className="flex items-center gap-3">
              <button onClick={toggleSidebar} className="btn-ghost p-2" title="Toggle sidebar"><PanelLeft size={16} /></button>
              <div className="flex items-center gap-1 bg-ink-100 dark:bg-ink-900 rounded-lg p-1">
                {[
                  { key: 'chat', icon: <MessageSquare size={13} />, label: 'Chat' },
                  { key: 'summary', icon: <Sparkles size={13} />, label: 'Summary' },
                ].map(tab => (
                  <button key={tab.key} onClick={() => setActivePanel(tab.key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all
                      ${activePanel === tab.key ? 'bg-white dark:bg-ink-800 text-ink-800 dark:text-ink-200 shadow-sm' : 'text-ink-500 hover:text-ink-700 dark:hover:text-ink-300'}`}>
                    {tab.icon}{tab.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setShowShortcuts(true)} className="btn-ghost p-2" title="Keyboard shortcuts"><Keyboard size={15} /></button>
              <button onClick={() => setShowSettings(true)} className="btn-ghost p-2" title="Settings"><Settings size={15} /></button>
              <button onClick={toggleDarkMode} className="btn-ghost p-2" title="Toggle dark mode">
                {darkMode ? <Sun size={16} /> : <Moon size={16} />}
              </button>
            </div>
          </header>

          <main className="flex-1 overflow-hidden">
            {activePanel === 'chat'
              ? (readyDocs.length === 0 && documents.length === 0 ? <EmptyState /> : <ChatWindow chatInputRef={chatInputRef} />)
              : <SummaryPanel docId={summaryTarget?.docId || readyDocs[0]?.doc_id} summaryType={summaryTarget?.type} />
            }
          </main>
        </div>

        {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
        {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
      </div>
    </ToastProvider>
  )
}
