export function LoadingState({ label = 'Loading', overlay = false }: { label?: string; overlay?: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={
        overlay
          ? 'pointer-events-none absolute inset-x-0 top-20 z-20 flex justify-center'
          : 'flex h-dvh w-full items-center justify-center bg-void'
      }
    >
      <div className="glass fade-up flex items-center gap-3 rounded-full px-4 py-2 text-xs text-ink-dim">
        <span className="relative flex h-4 w-4 items-center justify-center" aria-hidden>
          <span className="absolute h-4 w-4 rounded-full border border-primary/60" style={{ animation: 'pulse-ring 1.1s ease-out infinite' }} />
          <span className="brand-orb" style={{ width: 12, height: 12 }} />
        </span>
        {label}…
      </div>
    </div>
  )
}
