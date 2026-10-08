'use client'

import { useExploreNavigation } from '../navigation'

export function ErrorState({ message }: { message: string }) {
  const navigation = useExploreNavigation()
  return (
    <div role="alert" className="absolute inset-0 z-20 flex items-center justify-center p-4">
      <div className="glass glass-strong fade-up max-w-md rounded-xl p-5 text-sm">
        <p className="hud-label mb-2">Signal lost</p>
        <p className="text-ink">{message}</p>
        <p className="mt-2 text-xs text-ink-dim">
          If the database is empty, run <code className="font-mono">pnpm ingest:fixture</code> and{' '}
          <code className="font-mono">pnpm graph:build</code>, then reload.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={navigation.goUniverse}
            className="chip focus-ring rounded-md border border-primary/50 px-3 py-1 text-xs text-primary hover:bg-primary/15"
          >
            Back to universe
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="chip focus-ring rounded-md border border-ink-dim/30 px-3 py-1 text-xs text-ink-dim hover:text-ink"
          >
            Reload
          </button>
        </div>
      </div>
    </div>
  )
}
