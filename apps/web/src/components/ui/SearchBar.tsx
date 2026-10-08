'use client'

import { useEffect, useId, useRef, useState } from 'react'
import type { SearchHit } from '@constellation/search'
import { fetchSearch } from '@/lib/api'
import { NODE_TYPE_LABELS } from '@/lib/colors'
import { useNodeColor } from '@/lib/theme'
import { useCatalogStore } from '@/state/catalog-store'
import { useExploreNavigation } from '../navigation'

export function SearchBar() {
  const navigation = useExploreNavigation()
  const game = useCatalogStore((s) => s.game)
  const colorOf = useNodeColor()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchHit[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setLoading(false)
      return
    }
    const controller = new AbortController()
    setLoading(true)
    const timer = setTimeout(() => {
      fetchSearch(query, { game, limit: 12 }, controller.signal)
        .then((res) => {
          setResults(res.results)
          setActive(0)
          setOpen(true)
        })
        .catch(() => {})
        .finally(() => setLoading(false))
    }, 160)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, game])

  // "/" focuses the search from anywhere.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (event.key === '/' && target?.tagName !== 'INPUT' && target?.tagName !== 'TEXTAREA') {
        event.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const choose = (hit: SearchHit) => {
    setOpen(false)
    setQuery('')
    inputRef.current?.blur()
    navigation.goTo(hit.nodeId)
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) {
      if (event.key === 'Escape') (event.target as HTMLInputElement).blur()
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((a) => (a + 1) % results.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((a) => (a - 1 + results.length) % results.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const hit = results[active]
      if (hit) choose(hit)
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="relative">
      <div className="glass flex items-center gap-2 rounded-full px-4 py-2 transition focus-within:border-primary/60">
        <span className="text-ink-dim" aria-hidden>
          ⌕
        </span>
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && results[active] ? `${listId}-${active}` : undefined}
          aria-label="Search cards, sets, Pokémon, artists"
          placeholder="Search cards, sets, Pokémon, artists…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          className="w-full bg-transparent text-sm text-ink placeholder:text-ink-dim/70 focus:outline-none"
          autoComplete="off"
          spellCheck={false}
        />
        {loading ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" aria-hidden /> : null}
        <kbd className="hidden rounded border border-ink-dim/30 px-1.5 font-mono text-[10px] text-ink-dim md:block">/</kbd>
      </div>

      {open && results.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="glass glass-strong scroll-thin fade-up absolute inset-x-0 top-full z-40 mt-2 max-h-[60vh] overflow-y-auto rounded-xl p-1"
        >
          {results.map((hit, index) => (
            <li
              key={hit.nodeId}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              style={{ '--i': index } as React.CSSProperties}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(hit)}
              className={`pop-in lift flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                index === active ? 'bg-primary/15 text-ink' : 'text-ink/85'
              }`}
            >
              {hit.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={hit.image}
                  alt=""
                  loading="lazy"
                  className="h-10 w-7 flex-none rounded-sm object-cover opacity-90 shadow-[0_0_0_1px_var(--c-outline)]"
                />
              ) : (
                <span
                  className="flex h-10 w-7 flex-none items-center justify-center rounded-sm"
                  style={{ background: `${colorOf(hit.type)}22` }}
                  aria-hidden
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: colorOf(hit.type), boxShadow: '0 0 0 1px var(--c-outline)' }} />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate">{hit.title}</span>
                {hit.subtitle ? <span className="block truncate text-xs text-ink-dim">{hit.subtitle}</span> : null}
              </span>
              <span className="text-[10px] uppercase tracking-[0.18em]" style={{ color: colorOf(hit.type) }}>
                {NODE_TYPE_LABELS[hit.type]}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
