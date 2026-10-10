'use client'

import { useState } from 'react'
import type { LandmarkCategory } from '@/lib/landmarks-view'
import { edgeColor, useTheme } from '@/lib/theme'
import { buildExploreUrl } from '@/lib/url'
import { useLensStore } from '@/state/lens-store'
import { useTimeStore } from '@/state/time-store'
import { useUiStore } from '@/state/ui-store'
import { useExploreNavigation } from '../navigation'
import { NodeImage } from './NodeImage'

/** The button that opens the landmarks, on the universe (panel, list) and in the bottom bar. */
export function LandmarksButton({ className = '' }: { className?: string }) {
  const navigation = useExploreNavigation()
  return (
    <a
      href={buildExploreUrl({ ...navigation.current, node: null, path: null, pathMax: null, panel: null, lens: 'landmarks' })}
      onClick={(e) => {
        e.preventDefault()
        navigation.openLandmarks()
      }}
      className={`btn btn-ghost pill text-[12.5px] ${className}`}
      title="The points worth knowing first, and why"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z" />
      </svg>
      Landmarks
    </a>
  )
}

function Category({ category, variant, index }: { category: LandmarkCategory; variant: 'panel' | 'page'; index: number }) {
  const navigation = useExploreNavigation()
  const theme = useTheme()
  const hidden = useTimeStore((s) => s.hidden)
  const setHighlight = useUiStore((s) => s.setHighlight)
  const items = category.items.filter((i) => !hidden.has(i.node.id))
  const color = edgeColor(theme, category.relationshipType)
  return (
    <section
      className={`pop-in min-w-0 ${variant === 'page' ? 'panel p-4' : ''}`}
      style={{ '--i': index } as React.CSSProperties}
      aria-label={category.title}
      onMouseEnter={() => setHighlight(items.map((i) => i.node.id))}
      onMouseLeave={() => setHighlight(null)}
    >
      <h2 className={`${variant === 'page' ? 'serif text-[18px]' : 'eyebrow'} mb-0.5 flex items-center gap-2`}>
        <span className="inline-block h-[2px] w-4 flex-none rounded-full" style={{ background: color }} aria-hidden />
        {category.title}
      </h2>
      <p className="mb-2 text-[12.5px] text-ink-dim">{category.description}</p>
      {items.length === 0 ? <p className="text-[12.5px] text-ink-dim">Not yet, at this point in time.</p> : null}
      <ol className="space-y-0.5">
        {items.map((item, rank) => (
          <li key={item.node.id}>
            <a
              href={buildExploreUrl({ ...navigation.current, node: item.node.id, lens: null, panel: null })}
              onClick={(e) => {
                e.preventDefault()
                navigation.goTo(item.node.id)
              }}
              onMouseEnter={() => setHighlight([item.node.id])}
              onMouseLeave={() => setHighlight(items.map((i) => i.node.id))}
              className="row-link"
              data-node-id={item.node.id}
              title={`Explore ${item.node.label}`}
            >
              <span className="w-4 flex-none text-right text-[12px] tabular-nums text-ink-dim">{rank + 1}</span>
              <NodeImage
                node={item.node}
                small
                alt=""
                loading="lazy"
                className={
                  item.node.nodeType === 'set' || item.node.nodeType === 'series'
                    ? 'h-6 w-9 flex-none rounded-sm bg-node object-contain p-0.5'
                    : 'h-9 w-[26px] flex-none rounded object-cover'
                }
                placeholder={<span className="dot" style={{ color }} aria-hidden />}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px]">{item.node.label}</span>
                <span className="block truncate text-[12px] text-ink-dim">{item.reason}</span>
              </span>
            </a>
          </li>
        ))}
      </ol>
    </section>
  )
}

function useHeader() {
  const navigation = useExploreNavigation()
  const [copied, setCopied] = useState(false)
  const share = async () => {
    try {
      await navigator.clipboard.writeText(navigation.shareUrl())
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard unavailable
    }
  }
  return { navigation, copied, share }
}

/** In the sky: the categories on the right; the landmarks themselves stand around the game in the scene. */
export function LandmarksPanel() {
  const landmarks = useLensStore((s) => s.landmarks)
  const { navigation, copied, share } = useHeader()
  if (!landmarks) return null
  return (
    <aside
      id="landmarks-panel"
      aria-label="Landmarks"
      className="panel scroll-thin fade-up absolute right-4 top-16 z-30 flex max-h-[calc(100vh-9rem)] w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-y-auto"
    >
      <div className="p-5 pb-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="eyebrow">{landmarks.game.label}</span>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => navigation.closeLens(null)} className="btn btn-quiet text-[12.5px]" title="Back to the whole sky">
              ← Back to the sky
            </button>
            <button type="button" onClick={share} className="btn btn-quiet text-[12.5px]">
              {copied ? 'Link copied' : 'Share'}
            </button>
          </div>
        </div>
        <h1 className="title-reveal text-[24px] leading-tight text-ink">Landmarks</h1>
        <p className="mt-1 text-[13px] text-ink-dim">The points worth knowing first, each with the reason it stands out. Pick one to explore from there.</p>
      </div>
      <div className="space-y-5 border-t border-ink/10 px-5 py-4">
        {landmarks.categories.map((c, i) => (
          <Category key={c.id} category={c} variant="panel" index={i} />
        ))}
      </div>
    </aside>
  )
}

/** In the list: every category as a card. */
export function LandmarksPage() {
  const landmarks = useLensStore((s) => s.landmarks)
  const { navigation, copied, share } = useHeader()
  if (!landmarks) return null
  return (
    <main id="landmarks-page" aria-label="Landmarks" className="scroll-thin absolute inset-x-0 bottom-0 top-16 z-10 overflow-y-auto px-4 pb-40 pt-3">
      <div className="mx-auto w-full max-w-6xl">
        <header className="panel fade-up flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <span className="eyebrow">{landmarks.game.label}</span>
            <h1 className="title-reveal text-[26px] leading-tight">Landmarks</h1>
            <p className="text-[13px] text-ink-dim">The points worth knowing first, each with the reason it stands out.</p>
          </div>
          <div className="flex flex-none items-center gap-1">
            <button type="button" onClick={() => navigation.closeLens(null)} className="btn btn-quiet">
              ← Back to the sky
            </button>
            <button type="button" onClick={share} className="btn btn-ghost">
              {copied ? 'Link copied' : 'Share'}
            </button>
          </div>
        </header>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {landmarks.categories.map((c, i) => (
            <Category key={c.id} category={c} variant="page" index={i} />
          ))}
        </div>
      </div>
    </main>
  )
}
