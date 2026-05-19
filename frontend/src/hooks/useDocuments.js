/**
 * useDocuments Hook
 * Manages document fetching, polling for processing status, and refresh.
 *
 * Usage:
 *   const { documents, loading, error, refresh } = useDocuments()
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { documentsApi } from '../services/api'
import { useStore } from '../store/useStore'

export function useDocuments() {
  const { documents, setDocuments } = useStore()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const pollRef = useRef(null)

  const fetch = useCallback(async () => {
    try {
      const data = await documentsApi.list()
      setDocuments(data.documents || [])
      setError(null)
    } catch (err) {
      setError(err.message || 'Failed to load documents')
    } finally {
      setLoading(false)
    }
  }, [setDocuments])

  // Initial fetch
  useEffect(() => {
    fetch()
  }, [fetch])

  // Poll while any document is still processing
  useEffect(() => {
    const hasProcessing = documents.some(d => d.status === 'processing')

    if (hasProcessing && !pollRef.current) {
      pollRef.current = setInterval(fetch, 4000)
    } else if (!hasProcessing && pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [documents, fetch])

  return {
    documents,
    loading,
    error,
    refresh: fetch,
  }
}
