import { verifyWallet } from '@constellation/ownership'
import type { NextRequest } from 'next/server'
import { getDatabase } from '@/server/db'
import { errorResponse, json, rateLimit, readJson, stringField } from '@/server/http'
import { getProviderRegistry } from '@/server/ownership'
import { requireUser } from '@/server/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Prove control of the address: the wallet's signature over the pending challenge. */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ walletId: string }> },
) {
  const limited = rateLimit(request)
  if (limited) return limited
  try {
    const user = await requireUser()
    const { walletId } = await context.params
    const body = await readJson(request)
    const signature = stringField(body, 'signature', { required: true, max: 400 }) ?? ''
    const { db } = await getDatabase()
    const wallet = await verifyWallet(db, getProviderRegistry(), {
      ownerId: user.id,
      walletId,
      signature,
    })
    return json({ wallet }, { cache: 'no-store' })
  } catch (error) {
    return errorResponse(error)
  }
}
