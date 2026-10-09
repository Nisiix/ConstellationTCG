'use client'

import { useEffect } from 'react'

const MAX_REPORTS = 5

/**
 * Sends uncaught errors and unhandled rejections to `/api/client-error`, a few per page load, with
 * nothing that identifies the person: the message, the script, the page path, whether WebGL is on.
 * Renders nothing.
 */
export function ErrorReporter() {
  useEffect(() => {
    let sent = 0
    const report = (kind: string, message: string, source?: string, stack?: string) => {
      if (sent >= MAX_REPORTS || !message) return
      sent += 1
      const body = JSON.stringify({
        kind,
        message: message.slice(0, 500),
        source: source?.slice(0, 300),
        page: window.location.pathname,
        stack: stack?.slice(0, 1500),
        webgl: Boolean(document.createElement('canvas').getContext('webgl2')),
      })
      try {
        const sent = navigator.sendBeacon?.(
          '/api/client-error',
          new Blob([body], { type: 'application/json' }),
        )
        if (!sent)
          void fetch('/api/client-error', {
            method: 'POST',
            body,
            headers: { 'content-type': 'application/json' },
            keepalive: true,
          })
      } catch {
        // reporting must never throw
      }
    }
    const onError = (event: ErrorEvent) =>
      report('error', event.message, event.filename, (event.error as Error | undefined)?.stack)
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason as { message?: string; stack?: string } | string | undefined
      const message =
        typeof reason === 'string' ? reason : (reason?.message ?? 'Unhandled rejection')
      report(
        'unhandledrejection',
        message,
        undefined,
        typeof reason === 'object' ? reason?.stack : undefined,
      )
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])
  return null
}
