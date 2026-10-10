'use client'

import { nextStep, previousStep } from '@/lib/time'
import { useTimeStore } from '@/state/time-store'
import { useExploreNavigation } from '../navigation'

/**
 * The time cursor: the sky as it stood at the end of a year. Play walks the years that hold
 * something, one at a time; what appeared that year is marked in the sky and in the lists.
 * Shown in both views, above the bottom bar; "All of time" puts it away.
 */
export function TimeBar() {
  const navigation = useExploreNavigation()
  const year = useTimeStore((s) => s.year)
  const steps = useTimeStore((s) => s.steps)
  const fresh = useTimeStore((s) => s.fresh)
  const hidden = useTimeStore((s) => s.hidden)
  const playing = useTimeStore((s) => s.playing)
  const setPlaying = useTimeStore((s) => s.setPlaying)
  if (year === null) return null

  const first = steps[0] ?? year
  const last = steps.at(-1) ?? year
  const span = Math.max(1, last - first)
  const at = Math.min(Math.max(year, first), last)
  const previous = previousStep(steps, year)
  const next = nextStep(steps, year)

  const play = () => {
    if (playing) return setPlaying(false)
    // From the end, start again at the beginning.
    if (next === null && steps[0] !== undefined) navigation.setYear(steps[0])
    setPlaying(true)
  }
  const step = (to: number | null) => {
    if (to === null) return
    setPlaying(false)
    navigation.setYear(to)
  }
  const pick = (value: number) => {
    setPlaying(false)
    // Snap to the nearest year that holds something at or before the value.
    const snapped = [...steps].reverse().find((y) => y <= value) ?? first
    navigation.setYear(snapped)
  }

  return (
    <section
      id="time-bar"
      aria-label="Time"
      className="panel fade-up pointer-events-auto absolute bottom-[4.25rem] left-1/2 z-30 flex w-[min(40rem,calc(100vw-2rem))] -translate-x-1/2 items-center gap-3 px-3 py-2"
    >
      <div className="flex flex-none items-center gap-0.5">
        <button
          type="button"
          className="btn btn-quiet pill px-2"
          onClick={() => step(previous)}
          disabled={previous === null}
          aria-label="Previous year"
          title="Previous year"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
        <button type="button" className="btn btn-on pill px-2.5" onClick={play} aria-label={playing ? 'Pause' : 'Play the years'} title={playing ? 'Pause (T)' : 'Play the years'}>
          {playing ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M8 5.5v13l10.5-6.5z" />
            </svg>
          )}
        </button>
        <button
          type="button"
          className="btn btn-quiet pill px-2"
          onClick={() => step(next)}
          disabled={next === null}
          aria-label="Next year"
          title="Next year"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      </div>

      <div className="min-w-0 flex-1">
        <input
          type="range"
          className="time-range"
          min={first}
          max={last}
          step={1}
          value={at}
          onChange={(e) => pick(Number(e.target.value))}
          aria-label="Year"
          aria-valuetext={`${year}`}
        />
        <div className="time-ticks" aria-hidden>
          {steps.map((y) => (
            <span key={y} style={{ left: `${((y - first) / span) * 100}%` }} data-on={y <= year} />
          ))}
        </div>
      </div>

      <div className="flex flex-none items-baseline gap-2" aria-live="polite">
        <span className="serif text-[22px] leading-none text-ink" data-testid="time-year">
          {year}
        </span>
        <span className="hidden text-[12px] text-ink-dim sm:inline" title={`${hidden.size} not yet in the sky`}>
          {fresh.size > 0 ? `${fresh.size} new` : 'nothing new'}
        </span>
      </div>

      <button
        type="button"
        className="btn btn-quiet flex-none text-[12.5px]"
        onClick={() => {
          setPlaying(false)
          navigation.setYear(null)
        }}
        title="Show all of time (T)"
      >
        All of time
      </button>
    </section>
  )
}
