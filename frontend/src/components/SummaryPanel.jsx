/**
 * SummaryPanel Component
 * Displays document summaries with type selection
 */

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Sparkles, Loader, FileText, Copy, Check } from 'lucide-react'
import { documentsApi } from '../services/api'
import { useStore } from '../store/useStore'

const SUMMARY_TYPES = [
  { key: 'concise', label: 'Concise', desc: '3-5 sentences' },
  { key: 'detailed', label: 'Detailed', desc: 'Full analysis' },
  { key: 'bullets', label: 'Bullet Points', desc: 'Key points' },
]

export default function SummaryPanel({ docId, summaryType: initialType }) {
  const [summaryType, setSummaryType] = useState(initialType || 'concise')
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)

  const documents = useStore(s => s.documents)
  const doc = documents.find(d => d.doc_id === docId)

  const generateSummary = async (type) => {
    setLoading(true)
    setError(null)
    setSummaryType(type)

    try {
      const result = await documentsApi.summarize(docId, type)
      setSummary(result.summary)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to generate summary')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = () => {
    if (!summary) return
    navigator.clipboard.writeText(summary)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-ink-200 dark:border-ink-800">
        <h2 className="text-sm font-semibold text-ink-800 dark:text-ink-200 flex items-center gap-2">
          <Sparkles size={14} className="text-amber-400" />
          Document Summary
        </h2>
        {doc && (
          <p className="text-xs text-ink-400 mt-0.5 flex items-center gap-1 truncate">
            <FileText size={10} />
            {doc.filename}
          </p>
        )}
      </div>

      {/* Type selector */}
      <div className="px-4 py-3 border-b border-ink-200 dark:border-ink-800">
        <div className="grid grid-cols-3 gap-1.5">
          {SUMMARY_TYPES.map(({ key, label, desc }) => (
            <button
              key={key}
              onClick={() => generateSummary(key)}
              disabled={loading}
              className={`
                flex flex-col items-center gap-0.5 p-2.5 rounded-xl text-xs transition-all
                ${summaryType === key && summary
                  ? 'bg-amber-100 dark:bg-amber-900/30 border-2 border-amber-400 text-amber-700 dark:text-amber-400'
                  : 'border-2 border-ink-200 dark:border-ink-700 hover:border-ink-300 dark:hover:border-ink-600 text-ink-600 dark:text-ink-400'
                }
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              <span className="font-medium">{label}</span>
              <span className="text-[10px] opacity-70">{desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Summary output */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading && (
          <div className="flex flex-col gap-3 animate-fade-in">
            <div className="w-3/4 h-4 rounded shimmer-bg" />
            <div className="w-full h-4 rounded shimmer-bg" />
            <div className="w-5/6 h-4 rounded shimmer-bg" />
            <div className="w-full h-4 rounded shimmer-bg" />
            <div className="w-2/3 h-4 rounded shimmer-bg" />
          </div>
        )}

        {error && !loading && (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {summary && !loading && (
          <div className="space-y-3 animate-fade-in">
            <div className="bg-white dark:bg-ink-900 rounded-xl border border-ink-200 dark:border-ink-700 p-4">
              <div className="prose-doc">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {summary}
                </ReactMarkdown>
              </div>
            </div>

            <button
              onClick={copyToClipboard}
              className="flex items-center gap-2 text-xs text-ink-400 hover:text-ink-600 dark:hover:text-ink-300 transition-colors"
            >
              {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
              {copied ? 'Copied!' : 'Copy to clipboard'}
            </button>
          </div>
        )}

        {!summary && !loading && !error && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-ink-400">
            <div className="w-12 h-12 bg-ink-100 dark:bg-ink-800 rounded-2xl flex items-center justify-center">
              <Sparkles size={20} className="text-ink-300" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">Choose a summary type</p>
              <p className="text-xs opacity-70 mt-1">Select Concise, Detailed, or Bullets above</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
