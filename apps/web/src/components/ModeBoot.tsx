'use client'

import { useEffect } from 'react'
import { applyModeToDocument, currentMode, subscribeSystemMode } from '@/lib/mode'
import { useCatalogStore } from '@/state/catalog-store'

/**
 * Keeps the color mode in the store in step with the document: reads the visitor's preference
 * once mounted (the inline boot script already painted it) and follows the system setting while
 * no explicit choice is stored.
 */
export function ModeBoot() {
  const setMode = useCatalogStore((s) => s.setMode)
  useEffect(() => {
    const mode = currentMode()
    applyModeToDocument(mode)
    setMode(mode)
    return subscribeSystemMode((next) => {
      applyModeToDocument(next)
      setMode(next)
    })
  }, [setMode])
  return null
}
