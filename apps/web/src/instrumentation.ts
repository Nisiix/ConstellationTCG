/**
 * Runs once when the server starts (Next.js instrumentation hook): warms the database and the
 * caches so the first visitor does not pay for the cold start of the embedded database.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { warmUp } = await import('./server/warmup')
  void warmUp()
}
