'use client'

import { applyModeToDocument, writeModePreference } from '@/lib/mode'
import { useCatalogStore } from '@/state/catalog-store'

/**
 * Dark ↔ light. The choice is remembered per browser; the system setting applies until a choice
 * is made. Works on every page: the explorer re-resolves the game palette through the store,
 * static pages switch through the `data-mode` attribute alone.
 */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const mode = useCatalogStore((s) => s.mode)
  const setMode = useCatalogStore((s) => s.setMode)
  const next = mode === 'dark' ? 'light' : 'dark'
  const toggle = () => {
    writeModePreference(next)
    applyModeToDocument(next)
    setMode(next)
  }
  return (
    <button
      type="button"
      onClick={toggle}
      className={`btn btn-ghost pill ${className}`}
      aria-label={next === 'light' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={next === 'light' ? 'Light mode' : 'Dark mode'}
      data-mode={mode}
    >
      {mode === 'dark' ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        </svg>
      )}
    </button>
  )
}
