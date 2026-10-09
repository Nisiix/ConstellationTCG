'use client'

import { useEffect, useState } from 'react'
import { fetchSearch } from '@/lib/api'
import { useCatalogStore } from '@/state/catalog-store'
import { useGraphStore } from '@/state/graph-store'
import { useUiStore } from '@/state/ui-store'
import { useExploreNavigation } from '../navigation'

const STORAGE_KEY = 'constellation.welcome.dismissed'

const SUGGESTIONS = ['Charizard', 'Pikachu', 'Base Set', 'Mitsuhiro Arita', 'Eevee']

/**
 * First-visit guidance on the universe view: what this is, how to start, and a few searches
 * that lead somewhere interesting. Dismissed once, remembered per browser.
 */
export function WelcomeCard() {
  const navigation = useExploreNavigation()
  const isUniverse = useGraphStore((s) => s.isUniverse)
  const status = useGraphStore((s) => s.status)
  const game = useCatalogStore((s) => s.game)
  const setWelcomeVisible = useUiStore((s) => s.setWelcomeVisible)
  const [dismissed, setDismissed] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(STORAGE_KEY) === '1')
    } catch {
      setDismissed(false)
    }
  }, [])

  const visible = !dismissed && isUniverse && status === 'ready'
  useEffect(() => {
    setWelcomeVisible(visible)
    return () => setWelcomeVisible(false)
  }, [visible, setWelcomeVisible])

  const dismiss = () => {
    setDismissed(true)
    try {
      window.localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      // storage unavailable
    }
  }

  const jump = async (term: string) => {
    setBusy(term)
    try {
      const res = await fetchSearch(term, { game, limit: 1 })
      const hit = res.results[0]
      if (hit) {
        dismiss()
        navigation.goTo(hit.nodeId)
      }
    } catch {
      // ignore
    } finally {
      setBusy(null)
    }
  }

  if (!visible) return null

  return (
    <div className="pointer-events-none absolute inset-x-0 top-1/2 z-20 flex -translate-y-1/2 justify-center px-4 md:justify-start md:pl-6">
      <section aria-label="Welcome" className="panel panel-strong fade-up pointer-events-auto w-full max-w-md p-6">
        <p className="eyebrow mb-1">Welcome</p>
        <h2 className="serif title-reveal text-[26px] leading-tight">Every card is a point. Every relationship is a line.</h2>
        <p className="mt-3 text-[14px] leading-relaxed text-ink/85">
          Search a card, fly to it, then follow its connections: the set it belongs to, the Pokémon it shows, the artist who drew it, what it
          evolves from. Click any point to move there.
        </p>
        <div className="stagger mt-4 flex flex-wrap gap-1.5">
          <span className="eyebrow mr-1 self-center">Try</span>
          {SUGGESTIONS.map((term) => (
            <button key={term} type="button" onClick={() => jump(term)} className="chip" disabled={busy !== null}>
              {busy === term ? '…' : term}
            </button>
          ))}
        </div>
        <div className="mt-5 flex items-center justify-between gap-2 text-[12.5px] text-ink-dim">
          <span>
            Press <kbd>/</kbd> to search, <kbd>?</kbd> for help.
          </span>
          <button type="button" onClick={dismiss} className="btn btn-ghost">
            Got it
          </button>
        </div>
      </section>
    </div>
  )
}
