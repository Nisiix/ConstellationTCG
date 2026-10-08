'use client'

import { useExploreNavigation } from '../navigation'

export function ErrorState({ message }: { message: string }) {
  const navigation = useExploreNavigation()
  return (
    <div role="alert" className="absolute inset-0 z-20 flex items-center justify-center p-4">
      <div className="panel panel-strong fade-up max-w-md p-6 text-[14px]">
        <h2 className="serif mb-2 text-[20px]">We lost the signal</h2>
        <p className="text-ink">{message}</p>
        <p className="mt-2 text-[13px] text-ink-dim">
          If the database is empty, run <code>pnpm ingest:fixture</code> and <code>pnpm graph:build</code>, then reload.
        </p>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={navigation.goUniverse} className="btn btn-primary">
            Back to the universe
          </button>
          <button type="button" onClick={() => window.location.reload()} className="btn btn-ghost">
            Reload
          </button>
        </div>
      </div>
    </div>
  )
}
