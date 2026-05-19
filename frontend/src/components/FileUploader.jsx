/**
 * FileUploader Component
 * Drag-and-drop file upload with progress tracking
 */

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, File, CheckCircle, AlertCircle, Loader } from 'lucide-react'
import { documentsApi } from '../services/api'
import { useStore } from '../store/useStore'

const ACCEPTED_TYPES = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/plain': ['.txt'],
}

function UploadItem({ file, status, progress, error }) {
  const icons = {
    uploading: <Loader size={14} className="animate-spin text-amber-500" />,
    processing: <Loader size={14} className="animate-spin text-blue-500" />,
    done: <CheckCircle size={14} className="text-green-500" />,
    error: <AlertCircle size={14} className="text-red-500" />,
  }

  const labels = {
    uploading: `Uploading ${progress}%`,
    processing: 'Processing…',
    done: 'Ready',
    error: error || 'Failed',
  }

  return (
    <div className="flex items-center gap-3 p-2.5 rounded-lg bg-ink-50 dark:bg-ink-900/50 border border-ink-200 dark:border-ink-800 text-sm">
      <File size={14} className="text-ink-400 shrink-0" />
      <span className="flex-1 truncate text-ink-700 dark:text-ink-300 font-mono text-xs">
        {file.name}
      </span>
      <div className="flex items-center gap-1.5 text-xs text-ink-500">
        {icons[status]}
        <span>{labels[status]}</span>
      </div>
    </div>
  )
}

export default function FileUploader({ onUploadComplete }) {
  const [uploads, setUploads] = useState([]) // [{file, status, progress, error}]
  const addDocument = useStore(s => s.addDocument)

  const processFile = useCallback(async (file) => {
    const uploadId = Math.random().toString(36).slice(2)

    setUploads(prev => [...prev, { id: uploadId, file, status: 'uploading', progress: 0 }])

    const update = (patch) =>
      setUploads(prev => prev.map(u => u.id === uploadId ? { ...u, ...patch } : u))

    try {
      const doc = await documentsApi.upload(file, (pct) => {
        update({ progress: pct })
      })

      update({ status: 'processing' })
      addDocument(doc)

      // Poll until document is ready (background processing)
      let attempts = 0
      const poll = setInterval(async () => {
        attempts++
        if (attempts > 60) { // Stop after 5 minutes
          clearInterval(poll)
          update({ status: 'error', error: 'Processing timeout' })
          return
        }
        try {
          const fresh = await documentsApi.get(doc.doc_id)
          if (fresh.status === 'ready') {
            clearInterval(poll)
            update({ status: 'done' })
            onUploadComplete?.()
            // Update store with final chunk count
            addDocument(fresh)
          } else if (fresh.status === 'error') {
            clearInterval(poll)
            update({ status: 'error', error: fresh.error || 'Processing failed' })
          }
        } catch {
          // Retry on network error
        }
      }, 5000)

    } catch (err) {
      update({
        status: 'error',
        error: err.response?.data?.detail || err.message
      })
    }
  }, [addDocument, onUploadComplete])

  const onDrop = useCallback((acceptedFiles) => {
    acceptedFiles.forEach(processFile)
  }, [processFile])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: 50 * 1024 * 1024,
    multiple: true,
  })

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={`
          relative rounded-xl p-6 text-center cursor-pointer
          transition-all duration-200
          ${isDragActive
            ? 'bg-amber-50 dark:bg-amber-950/20 animate-border-dash border-0'
            : 'border-2 border-dashed border-ink-300 dark:border-ink-700 hover:animate-border-dash hover:border-transparent hover:bg-ink-50 dark:hover:bg-ink-900/30'
          }
        `}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-2">
          <div className={`p-2.5 rounded-xl transition-colors ${isDragActive ? 'bg-amber-100 dark:bg-amber-900/40' : 'bg-ink-100 dark:bg-ink-800'}`}>
            <Upload size={20} className={isDragActive ? 'text-amber-500' : 'text-ink-500'} />
          </div>
          <div>
            <p className="text-sm font-medium text-ink-700 dark:text-ink-300">
              {isDragActive ? 'Drop files here' : 'Upload documents'}
            </p>
            <p className="text-xs text-ink-400 mt-0.5">
              PDF, DOCX, TXT — up to 50MB each
            </p>
          </div>
        </div>
      </div>

      {/* Upload progress list */}
      {uploads.length > 0 && (
        <div className="space-y-1.5">
          {uploads.map(u => (
            <UploadItem key={u.id} {...u} />
          ))}
        </div>
      )}
    </div>
  )
}
