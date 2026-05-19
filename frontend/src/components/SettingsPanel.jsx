/**
 * Settings Panel Component
 * Configure RAG parameters, UI preferences, and view API info
 */

import { useState } from 'react'
import { Settings, X, Save, RefreshCw, Info } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'

const DEFAULT_SETTINGS = {
  streamingEnabled: true,
  showSourcesByDefault: false,
  topK: 5,
  similarityThreshold: 0.3,
  summaryType: 'concise',
  maxHistoryTurns: 6,
  theme: 'system',
}

function ToggleSwitch({ checked, onChange, label, description }) {
  return (
    <label className="flex items-center justify-between gap-4 cursor-pointer">
      <div>
        <p className="text-sm font-medium text-ink-700 dark:text-ink-300">{label}</p>
        {description && (
          <p className="text-xs text-ink-400 mt-0.5">{description}</p>
        )}
      </div>
      <div
        onClick={() => onChange(!checked)}
        className={`
          relative w-10 h-5.5 rounded-full transition-colors cursor-pointer shrink-0
          ${checked ? 'bg-amber-400' : 'bg-ink-300 dark:bg-ink-700'}
        `}
        style={{ height: '22px', width: '40px' }}
      >
        <div className={`
          absolute top-0.5 w-4.5 h-4.5 bg-white rounded-full shadow-sm transition-transform
          ${checked ? 'translate-x-5' : 'translate-x-0.5'}
        `} style={{ width: '18px', height: '18px' }} />
      </div>
    </label>
  )
}

function Slider({ value, onChange, min, max, step, label, description, format }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div>
          <p className="text-sm font-medium text-ink-700 dark:text-ink-300">{label}</p>
          {description && <p className="text-xs text-ink-400">{description}</p>}
        </div>
        <span className="text-sm font-mono font-medium text-amber-600 dark:text-amber-400">
          {format ? format(value) : value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-ink-200 dark:bg-ink-700 rounded-full appearance-none cursor-pointer accent-amber-400"
      />
      <div className="flex justify-between text-[10px] text-ink-400 mt-1">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  )
}

export default function SettingsPanel({ onClose }) {
  const [settings, setSettings] = useLocalStorage('rag-settings', DEFAULT_SETTINGS)
  const [saved, setSaved] = useState(false)

  const update = (key, value) => setSettings(prev => ({ ...prev, [key]: value }))

  const handleSave = () => {
    // Settings are already saved via useLocalStorage
    // This just shows a confirmation
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-ink-950 border border-ink-200 dark:border-ink-700 rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink-200 dark:border-ink-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-ink-100 dark:bg-ink-800 rounded-lg flex items-center justify-center">
              <Settings size={16} className="text-ink-500" />
            </div>
            <h2 className="font-semibold text-ink-800 dark:text-ink-200">Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-ink-100 dark:hover:bg-ink-800 rounded-lg transition-colors text-ink-400"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Chat Settings */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-ink-400 mb-3">
              Chat
            </h3>
            <div className="space-y-4">
              <ToggleSwitch
                checked={settings.streamingEnabled}
                onChange={v => update('streamingEnabled', v)}
                label="Streaming Responses"
                description="Show answer token-by-token as it generates"
              />
              <ToggleSwitch
                checked={settings.showSourcesByDefault}
                onChange={v => update('showSourcesByDefault', v)}
                label="Show Sources by Default"
                description="Auto-expand source citations under each answer"
              />
              <Slider
                value={settings.maxHistoryTurns}
                onChange={v => update('maxHistoryTurns', v)}
                min={2}
                max={20}
                step={2}
                label="Chat History Length"
                description="How many past messages to include as context"
              />
            </div>
          </section>

          {/* Retrieval Settings */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-ink-400 mb-3">
              Retrieval (RAG)
            </h3>
            <div className="space-y-4">
              <Slider
                value={settings.topK}
                onChange={v => update('topK', v)}
                min={1}
                max={15}
                step={1}
                label="Retrieved Chunks (Top-K)"
                description="More chunks = more context but higher cost"
              />
              <Slider
                value={settings.similarityThreshold}
                onChange={v => update('similarityThreshold', v)}
                min={0.1}
                max={0.9}
                step={0.05}
                label="Similarity Threshold"
                description="Minimum score to include a chunk (higher = stricter)"
                format={v => v.toFixed(2)}
              />
            </div>
          </section>

          {/* Summary Settings */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-ink-400 mb-3">
              Summaries
            </h3>
            <div>
              <p className="text-sm font-medium text-ink-700 dark:text-ink-300 mb-2">
                Default Summary Type
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {['concise', 'detailed', 'bullets'].map(type => (
                  <button
                    key={type}
                    onClick={() => update('summaryType', type)}
                    className={`
                      py-2 px-3 rounded-lg text-xs font-medium transition-all
                      ${settings.summaryType === type
                        ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-2 border-amber-300'
                        : 'border-2 border-ink-200 dark:border-ink-700 text-ink-500 hover:border-ink-300'
                      }
                    `}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Info */}
          <section className="p-3 bg-ink-50 dark:bg-ink-900/50 rounded-xl border border-ink-200 dark:border-ink-700">
            <div className="flex items-start gap-2">
              <Info size={14} className="text-ink-400 shrink-0 mt-0.5" />
              <div className="text-xs text-ink-500 space-y-1">
                <p>RAG parameters (Top-K, threshold) on this page are for UI reference only.</p>
                <p>To change backend defaults, update the <code className="font-mono bg-ink-200 dark:bg-ink-800 px-1 rounded">.env</code> file and restart the server.</p>
              </div>
            </div>
          </section>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-ink-200 dark:border-ink-800">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 text-xs text-ink-400 hover:text-ink-600 dark:hover:text-ink-300 transition-colors"
          >
            <RefreshCw size={13} />
            Reset to defaults
          </button>
          <button
            onClick={handleSave}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${saved
                ? 'bg-green-500 text-white'
                : 'bg-ink-900 dark:bg-amber-500 text-white dark:text-ink-950 hover:bg-ink-700 dark:hover:bg-amber-400'
              }
            `}
          >
            <Save size={14} />
            {saved ? 'Saved!' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  )
}
