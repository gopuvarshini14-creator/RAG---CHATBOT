/**
 * useLocalStorage Hook
 * Persists state to localStorage with JSON serialization.
 *
 * Usage:
 *   const [theme, setTheme] = useLocalStorage('theme', 'light')
 */

import { useState, useEffect } from 'react'

export function useLocalStorage(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key)
      return stored !== null ? JSON.parse(stored) : defaultValue
    } catch {
      return defaultValue
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Storage quota exceeded or private mode
    }
  }, [key, value])

  return [value, setValue]
}
