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
  const [empty, setEmpty] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setLoading(false)
      setEmpty(false)
      return
    }
    const controller = new AbortController()
    setLoading(true)
    const timer = setTimeout(() => {
      fetchSearch(query, { game, limit: 12 }, controller.signal)
        .then((res) => {
          setResults(res.results)
          setEmpty(res.results.length === 0)
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
      <div className="panel pill flex items-center gap-2 px-4 py-2 transition focus-within:border-primary/50">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-dim" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && results[active] ? `${listId}-${active}` : undefined}
          aria-label="Search a card, set, Pokémon or artist"
          placeholder="Search a card, set, Pokémon or artist…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          className="w-full bg-transparent text-[14.5px] text-ink placeholder:text-ink-dim/80 focus:outline-none"
          autoComplete="off"
          spellCheck={false}
        />
        {loading ? <span className="h-2 w-2 animate-pulse rounded-full bg-primary" aria-hidden /> : null}
        <kbd className="hidden md:block">/</kbd>
      </div>

      {open && (results.length > 0 || empty) ? (
        <ul
          id={listId}
          role="listbox"
          className="panel panel-strong scroll-thin fade-up absolute inset-x-0 top-full z-40 mt-2 max-h-[60vh] overflow-y-auto p-1.5"
        >
          {empty ? <li className="px-3 py-4 text-sm text-ink-dim">Nothing found for “{query}”. Try a card name, a set or an artist.</li> : null}
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
              className={`row-link pop-in cursor-pointer ${index === active ? 'bg-primary/15' : ''}`}
            >
              {hit.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={hit.image} alt="" loading="lazy" className="h-11 w-8 flex-none rounded-md object-cover shadow-[0_0_0_1px_var(--c-outline)]" />
              ) : (
                <span className="flex h-11 w-8 flex-none items-center justify-center rounded-md" style={{ background: `${colorOf(hit.type)}22` }} aria-hidden>
                  <span className="dot" style={{ background: colorOf(hit.type) }} />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate">{hit.title}</span>
                {hit.subtitle ? <span className="block truncate text-[12.5px] text-ink-dim">{hit.subtitle}</span> : null}
              </span>
              <span className="chip text-[11.5px]" style={{ color: colorOf(hit.type), borderColor: `${colorOf(hit.type)}55` }}>
                {NODE_TYPE_LABELS[hit.type]}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
