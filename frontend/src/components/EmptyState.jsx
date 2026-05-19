/**
 * EmptyState Component
 * Shown in the chat area before any documents are uploaded.
 * Guides new users through the workflow.
 */

import { Upload, MessageSquare, Sparkles, ArrowRight } from 'lucide-react'

const STEPS = [
  {
    icon: <Upload size={20} className="text-amber-500" />,
    title: 'Upload a document',
    description: 'Drag & drop a PDF, DOCX, or TXT file into the sidebar',
    color: 'bg-amber-50 dark:bg-amber-950/30',
  },
  {
    icon: <Sparkles size={20} className="text-blue-500" />,
    title: 'Wait for processing',
    description: 'The system extracts text, creates chunks, and builds a semantic index',
    color: 'bg-blue-50 dark:bg-blue-950/30',
  },
  {
    icon: <MessageSquare size={20} className="text-green-500" />,
    title: 'Ask questions',
    description: 'Chat naturally — get answers with source citations from your documents',
    color: 'bg-green-50 dark:bg-green-950/30',
  },
]

const EXAMPLE_QUESTIONS = [
  'What are the main conclusions?',
  'Summarize section 3',
  'What does the document say about pricing?',
  'List all action items mentioned',
  'Who are the key stakeholders?',
  'What are the risks identified?',
]

export default function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-12 max-w-lg mx-auto text-center">
      {/* Hero */}
      <div className="mb-8">
        <div className="w-16 h-16 bg-gradient-to-br from-amber-300 to-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-200 dark:shadow-amber-900/40">
          <span className="text-3xl">📄</span>
        </div>
        <h2 className="font-display text-2xl font-bold text-ink-900 dark:text-ink-100 mb-2">
          Document Q&A
        </h2>
        <p className="text-ink-500 text-sm leading-relaxed">
          Upload your documents and start asking questions.
          AI will find the answers directly from your content.
        </p>
      </div>

      {/* Steps */}
      <div className="w-full space-y-2 mb-8">
        {STEPS.map((step, i) => (
          <div key={i} className="flex items-start gap-3 text-left">
            <div className="flex items-center gap-2 shrink-0">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${step.color}`}>
                {step.icon}
              </div>
              {i < STEPS.length - 1 && (
                <ArrowRight size={14} className="text-ink-300 dark:text-ink-700" />
              )}
            </div>
            <div className={i < STEPS.length - 1 ? 'flex-1' : ''}>
              <p className="text-sm font-medium text-ink-700 dark:text-ink-300">{step.title}</p>
              <p className="text-xs text-ink-400 mt-0.5">{step.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Example questions */}
      <div className="w-full">
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-400 mb-3">
          Example questions you can ask
        </p>
        <div className="grid grid-cols-2 gap-2">
          {EXAMPLE_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => alert("Please upload a document first to ask questions!")}
              className="text-left text-xs p-3 rounded-xl bg-ink-50 dark:bg-ink-900/50 border border-ink-200 dark:border-ink-800 text-ink-600 dark:text-ink-300 hover:border-amber-400 dark:hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all cursor-pointer shadow-sm"
            >
              "{q}"
            </button>
          ))}
        </div>
      </div>

      {/* Supported formats */}
      <div className="mt-8 flex items-center gap-3">
        {['PDF', 'DOCX', 'TXT'].map(ext => (
          <span
            key={ext}
            className="px-3 py-1 rounded-full bg-ink-100 dark:bg-ink-800 text-xs font-mono font-medium text-ink-500"
          >
            .{ext.toLowerCase()}
          </span>
        ))}
        <span className="text-xs text-ink-400">up to 50MB</span>
      </div>
    </div>
  )
}
