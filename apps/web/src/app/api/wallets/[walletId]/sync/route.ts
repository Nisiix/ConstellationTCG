import { getWallet, syncWallet, toWalletRecord } from '@constellation/ownership'
import type { NextRequest } from 'next/server'
import { DEFAULT_GAME } from '@/server/adapters'
import { getDatabase } from '@/server/db'
import { errorResponse, json, rateLimit, readJson, stringField } from '@/server/http'
import { getProviderRegistry } from '@/server/ownership'
import { requireUser } from '@/server/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Read what the address holds, resolve it against the catalog, refresh the overlay. */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ walletId: string }> },
) {
  const limited = rateLimit(request)
  if (limited) return limited
  try {
    const user = await requireUser()
    const { walletId } = await context.params
    const body = request.headers.get('content-type')?.includes('json')
      ? await readJson(request)
      : {}
    const game = stringField(body, 'game', { max: 40 }) ?? DEFAULT_GAME
    const { db } = await getDatabase()
    const summary = await syncWallet(db, getProviderRegistry(), {
      ownerId: user.id,
      walletId,
      game,
      fetch: { signal: AbortSignal.timeout(45_000), maxAssets: 2_000 },
    })
    const row = await getWallet(db, user.id, walletId)
    return json({ summary, wallet: row ? toWalletRecord(row) : null }, { cache: 'no-store' })
  } catch (error) {
    return errorResponse(error)
  }
}
