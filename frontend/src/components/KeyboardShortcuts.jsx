/**
 * Keyboard Shortcuts
 * Global hotkeys for power users.
 *
 * Shortcuts:
 *   Ctrl/Cmd + K  → Focus chat input
 *   Ctrl/Cmd + U  → Open file upload
 *   Ctrl/Cmd + /  → Toggle shortcuts modal
 *   Escape         → Close modals
 *   Ctrl/Cmd + L  → Clear chat
 */

import { useEffect, useState } from 'react'
import { Keyboard, X } from 'lucide-react'
import { useStore } from '../store/useStore'

const SHORTCUTS = [
  { keys: ['Ctrl', 'K'], mac: ['⌘', 'K'], description: 'Focus chat input' },
  { keys: ['Ctrl', 'U'], mac: ['⌘', 'U'], description: 'Upload document' },
  { keys: ['Ctrl', 'L'], mac: ['⌘', 'L'], description: 'Clear chat history' },
  { keys: ['Ctrl', '/'], mac: ['⌘', '/'], description: 'Show keyboard shortcuts' },
  { keys: ['Ctrl', 'B'], mac: ['⌘', 'B'], description: 'Toggle sidebar' },
  { keys: ['Ctrl', 'D'], mac: ['⌘', 'D'], description: 'Toggle dark mode' },
  { keys: ['Escape'], mac: ['Esc'], description: 'Close modal / cancel' },
]

function isMac() {
  return navigator.platform.toUpperCase().indexOf('MAC') >= 0
}

function KeyBadge({ keys }) {
  return (
    <div className="flex items-center gap-1">
      {keys.map((key, i) => (
        <kbd
          key={i}
          className="px-1.5 py-0.5 text-[11px] font-mono bg-ink-100 dark:bg-ink-800 border border-ink-300 dark:border-ink-600 rounded text-ink-600 dark:text-ink-400 shadow-sm"
        >
          {key}
        </kbd>
      ))}
    </div>
  )
}

export function ShortcutsModal({ onClose }) {
  const mac = isMac()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-ink-950 border border-ink-200 dark:border-ink-700 rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink-200 dark:border-ink-800">
          <div className="flex items-center gap-2">
            <Keyboard size={16} className="text-ink-400" />
            <h2 className="font-semibold text-sm text-ink-800 dark:text-ink-200">
              Keyboard Shortcuts
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-ink-100 dark:hover:bg-ink-800 rounded-lg text-ink-400">
            <X size={15} />
          </button>
        </div>
        <div className="p-4 space-y-2">
          {SHORTCUTS.map(({ keys, mac: macKeys, description }) => (
            <div key={description} className="flex items-center justify-between gap-4">
              <span className="text-sm text-ink-600 dark:text-ink-400">{description}</span>
              <KeyBadge keys={mac ? macKeys : keys} />
            </div>
          ))}
        </div>
        <div className="px-5 pb-4">
          <p className="text-xs text-ink-400 text-center">
            Press <kbd className="px-1 py-0.5 text-[11px] font-mono bg-ink-100 dark:bg-ink-800 border border-ink-300 rounded">Esc</kbd> to close
          </p>
        </div>
      </div>
    </div>
  )
}

/**
 * Hook that registers global keyboard shortcuts.
 * Returns showShortcuts state to allow rendering the modal.
 */
export function useKeyboardShortcuts({ onUpload, chatInputRef, fileInputRef }) {
  const { clearMessages, toggleSidebar, toggleDarkMode } = useStore()
  const [showShortcuts, setShowShortcuts] = useState(false)

  useEffect(() => {
    const handler = (e) => {
      const mod = e.ctrlKey || e.metaKey

      // Don't trigger if typing in an input (except Escape)
      const inInput = ['INPUT', 'TEXTAREA'].includes(e.target.tagName)

      if (e.key === 'Escape') {
        setShowShortcuts(false)
        return
      }

      if (inInput) return

      if (mod && e.key === 'k') {
        e.preventDefault()
        chatInputRef?.current?.focus()
      }

      if (mod && e.key === 'u') {
        e.preventDefault()
        fileInputRef?.current?.click()
      }

      if (mod && e.key === 'l') {
        e.preventDefault()
        clearMessages()
      }

      if (mod && e.key === '/') {
        e.preventDefault()
        setShowShortcuts(v => !v)
      }

      if (mod && e.key === 'b') {
        e.preventDefault()
        toggleSidebar()
      }

      if (mod && e.key === 'd') {
        e.preventDefault()
        toggleDarkMode()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [clearMessages, toggleSidebar, toggleDarkMode, chatInputRef, fileInputRef])

  return { showShortcuts, setShowShortcuts }
}
