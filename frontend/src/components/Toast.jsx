/**
 * Toast Notification System
 * Lightweight toast without external dependencies.
 *
 * Usage:
 *   import { useToast, Toaster } from './Toast'
 *
 *   // In component:
 *   const { toast } = useToast()
 *   toast.success('Document uploaded!')
 *   toast.error('Upload failed')
 *   toast.info('Processing...')
 *
 *   // In App.jsx root:
 *   <Toaster />
 */

import { useState, useCallback, useEffect, createContext, useContext } from 'react'
import { CheckCircle, AlertCircle, Info, X, AlertTriangle } from 'lucide-react'

// ─── Context ─────────────────────────────────────────────────
const ToastContext = createContext(null)

let _addToast = null  // Module-level ref for imperative usage

// ─── Provider ─────────────────────────────────────────────────
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type, duration }])
    if (duration > 0) {
      setTimeout(() => removeToast(id), duration)
    }
    return id
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // Expose to module level for non-component usage
  useEffect(() => {
    _addToast = addToast
    return () => { _addToast = null }
  }, [addToast])

  const toast = {
    success: (msg, dur) => addToast(msg, 'success', dur),
    error: (msg, dur) => addToast(msg, 'error', dur || 6000),
    info: (msg, dur) => addToast(msg, 'info', dur),
    warning: (msg, dur) => addToast(msg, 'warning', dur),
  }

  return (
    <ToastContext.Provider value={{ toast, addToast, removeToast }}>
      {children}
      <Toaster toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

// ─── Imperative usage (outside components) ────────────────────
export const toast = {
  success: (msg, dur) => _addToast?.(msg, 'success', dur),
  error: (msg, dur) => _addToast?.(msg, 'error', dur || 6000),
  info: (msg, dur) => _addToast?.(msg, 'info', dur),
  warning: (msg, dur) => _addToast?.(msg, 'warning', dur),
}

// ─── Toast Item ───────────────────────────────────────────────
const TOAST_STYLES = {
  success: {
    container: 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800',
    icon: <CheckCircle size={16} className="text-green-500 shrink-0" />,
    text: 'text-green-800 dark:text-green-200',
  },
  error: {
    container: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800',
    icon: <AlertCircle size={16} className="text-red-500 shrink-0" />,
    text: 'text-red-800 dark:text-red-200',
  },
  warning: {
    container: 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800',
    icon: <AlertTriangle size={16} className="text-amber-500 shrink-0" />,
    text: 'text-amber-800 dark:text-amber-200',
  },
  info: {
    container: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800',
    icon: <Info size={16} className="text-blue-500 shrink-0" />,
    text: 'text-blue-800 dark:text-blue-200',
  },
}

function ToastItem({ toast, onDismiss }) {
  const style = TOAST_STYLES[toast.type] || TOAST_STYLES.info

  return (
    <div className={`
      flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg
      animate-slide-up max-w-sm w-full
      ${style.container}
    `}>
      {style.icon}
      <p className={`flex-1 text-sm font-medium ${style.text}`}>
        {toast.message}
      </p>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-ink-400 hover:text-ink-600 transition-colors shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  )
}

// ─── Toaster (render in App root) ────────────────────────────
export function Toaster({ toasts, onDismiss }) {
  if (!toasts || toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 items-end">
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  )
}
