export function LoadingState({ label = 'Loading', overlay = false }: { label?: string; overlay?: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={overlay ? 'pointer-events-none absolute inset-x-0 top-20 z-20 flex justify-center' : 'flex h-dvh w-full items-center justify-center bg-void'}
    >
      <div className="panel pill fade-up flex items-center gap-3 px-4 py-2 text-[13px] text-ink-dim">
        <span className="relative flex h-5 w-5 items-center justify-center" aria-hidden>
          <span className="absolute h-5 w-5 rounded-full border border-primary/60" style={{ animation: 'pulse-ring 1.1s ease-out infinite' }} />
          <span className="brand-orb" style={{ width: 14, height: 14 }} />
        </span>
        {label}…
      </div>
    </div>
  )
}
