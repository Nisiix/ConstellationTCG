'use client'

import { useEffect, useMemo, useState } from 'react'
import type { FilterDefinition } from '@constellation/domain'
import { activeFilterCount, useCatalogStore } from '@/state/catalog-store'
import { useUiStore } from '@/state/ui-store'
import { useExploreNavigation } from '../navigation'

const HIDDEN = new Set(['tcg', 'graphDepth'])

export function FilterPanel() {
  const open = useUiStore((s) => s.filtersOpen)
  const setOpen = useUiStore((s) => s.setFiltersOpen)
  const filters = useCatalogStore((s) => s.filters)
  const status = useCatalogStore((s) => s.filtersStatus)
  const selection = useCatalogStore((s) => s.selection)
  const navigation = useExploreNavigation()
  const count = activeFilterCount(selection)

  const visible = useMemo(
    () => filters.filter((f) => !HIDDEN.has(f.id) && (f.values?.length || f.type === 'range' || f.type === 'boolean')),
    [filters],
  )

  const update = (id: string, value: string | null) => {
    const next = { ...selection }
    if (!value) delete next[id]
    else next[id] = value
    navigation.setFilters(next)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`btn pill absolute left-4 top-16 z-30 ${open || count > 0 ? 'btn-on' : 'btn-ghost'}`}
        aria-expanded={open}
        aria-controls="filter-panel"
        title="Filters (F)"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M4 6h16M7 12h10M10 18h4" />
        </svg>
        Filters
        {count > 0 ? <span className="rounded-full bg-primary/25 px-1.5 text-[11px]">{count}</span> : null}
      </button>
      <aside
        id="filter-panel"
        aria-label="Filters"
        className={`panel scroll-thin absolute left-4 top-28 z-30 max-h-[calc(100vh-11rem)] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto p-4 ${
          open ? 'fade-up' : 'pointer-events-none opacity-0'
        }`}
        hidden={!open}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="serif text-[17px]">Filters</h2>
          <div className="flex items-center gap-1">
            {count > 0 ? (
              <button type="button" onClick={() => navigation.setFilters({})} className="btn btn-quiet text-[12.5px]">
                Clear all
              </button>
            ) : null}
            <button type="button" onClick={() => setOpen(false)} className="btn btn-quiet" aria-label="Close filters">
              ×
            </button>
          </div>
        </div>
        {status === 'loading' ? <p className="text-sm text-ink-dim">Loading filters…</p> : null}
        {status === 'error' ? <p className="text-sm text-rose-500">Filters are unavailable right now.</p> : null}
        <div className="space-y-5">
          {visible.map((filter, i) => (
            <div key={filter.id} className="pop-in" style={{ '--i': i } as React.CSSProperties}>
              <FilterControl filter={filter} value={selection[filter.id] ?? ''} onChange={update} />
            </div>
          ))}
        </div>
      </aside>
    </>
  )
}

function FilterControl({
  filter,
  value,
  onChange,
}: {
  filter: FilterDefinition
  value: string
  onChange: (id: string, value: string | null) => void
}) {
  if (filter.type === 'select') {
    return (
      <label className="block">
        <span className="eyebrow block pb-1.5">{filter.label}</span>
        <select value={value} onChange={(e) => onChange(filter.id, e.target.value || null)} className="field">
          <option value="">Any</option>
          {filter.values?.map((v) => (
            <option key={v.value} value={v.value}>
              {v.label}
              {v.count !== undefined ? ` (${v.count})` : ''}
            </option>
          ))}
        </select>
      </label>
    )
  }
  if (filter.type === 'multi') return <MultiControl filter={filter} value={value} onChange={onChange} />
  if (filter.type === 'range') return <RangeControl filter={filter} value={value} onChange={onChange} />
  return (
    <label className="flex items-center justify-between text-sm">
      <span className="eyebrow">{filter.label}</span>
      <input type="checkbox" checked={value === 'true'} onChange={(e) => onChange(filter.id, e.target.checked ? 'true' : null)} className="focus-ring accent-primary" />
    </label>
  )
}

function MultiControl({
  filter,
  value,
  onChange,
}: {
  filter: FilterDefinition
  value: string
  onChange: (id: string, value: string | null) => void
}) {
  const [showAll, setShowAll] = useState(false)
  const selected = new Set(value ? value.split(',') : [])
  const values = filter.values ?? []
  const shown = showAll ? values : values.slice(0, 10)
  const toggle = (v: string) => {
    const next = new Set(selected)
    if (next.has(v)) next.delete(v)
    else next.add(v)
    onChange(filter.id, next.size ? [...next].join(',') : null)
  }
  return (
    <fieldset>
      <legend className="eyebrow pb-1.5">{filter.label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {shown.map((v) => {
          const on = selected.has(v.value)
          return (
            <button key={v.value} type="button" aria-pressed={on} onClick={() => toggle(v.value)} className={`chip ${on ? 'chip-on' : ''}`} title={v.count !== undefined ? `${v.count} cards` : undefined}>
              {v.label}
            </button>
          )
        })}
        {values.length > 10 ? (
          <button type="button" onClick={() => setShowAll((s) => !s)} className="chip">
            {showAll ? 'Show less' : `${values.length - 10} more`}
          </button>
        ) : null}
      </div>
    </fieldset>
  )
}

function RangeControl({
  filter,
  value,
  onChange,
}: {
  filter: FilterDefinition
  value: string
  onChange: (id: string, value: string | null) => void
}) {
  const min = filter.min ?? 0
  const max = filter.max ?? 100
  const [lo, hi] = value ? value.split('..').map(Number) : [min, max]
  const [local, setLocal] = useState<[number, number]>([lo ?? min, hi ?? max])
  useEffect(() => {
    setLocal([lo ?? min, hi ?? max])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, min, max])
  const commit = (next: [number, number]) => {
    const [a, b] = next
    if (a <= min && b >= max) onChange(filter.id, null)
    else onChange(filter.id, `${a}..${b}`)
  }
  return (
    <fieldset>
      <legend className="eyebrow pb-1.5">
        {filter.label} <span className="font-normal text-ink-dim">({local[0]}–{local[1]})</span>
      </legend>
      <div className="flex items-center gap-2">
        <input type="number" aria-label={`${filter.label} minimum`} min={min} max={max} value={local[0]} onChange={(e) => setLocal([Number(e.target.value), local[1]])} onBlur={() => commit(local)} className="field" />
        <span className="text-ink-dim">to</span>
        <input type="number" aria-label={`${filter.label} maximum`} min={min} max={max} value={local[1]} onChange={(e) => setLocal([local[0], Number(e.target.value)])} onBlur={() => commit(local)} className="field" />
      </div>
    </fieldset>
  )
}
