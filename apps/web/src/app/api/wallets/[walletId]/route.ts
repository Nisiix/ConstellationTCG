import { removeWallet } from '@constellation/ownership'
import { ValidationError } from '@constellation/domain'
import type { NextRequest } from 'next/server'
import { getDatabase } from '@/server/db'
import { errorResponse, json, rateLimit } from '@/server/http'
import { requireUser } from '@/server/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Unlink a wallet: its ownership rows leave the overlay with it. */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ walletId: string }> },
) {
  const limited = rateLimit(request)
  if (limited) return limited
  try {
    const user = await requireUser()
    const { walletId } = await context.params
    const { db } = await getDatabase()
    const removed = await removeWallet(db, user.id, walletId)
    if (!removed) throw new ValidationError('Wallet not found', { status: 404, walletId })
    return json({ removed: true }, { cache: 'no-store' })
  } catch (error) {
    return errorResponse(error)
  }
}
