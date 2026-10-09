import { linkWallet, listWalletChallenges, listWallets } from '@constellation/ownership'
import type { NextRequest } from 'next/server'
import { getDatabase } from '@/server/db'
import { errorResponse, json, rateLimit, readJson, stringField } from '@/server/http'
import { getProviderRegistry } from '@/server/ownership'
import { requireUser } from '@/server/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** The signed-in user's wallets, with the challenge still to sign for the unverified ones. */
export async function GET(request: NextRequest) {
  const limited = rateLimit(request)
  if (limited) return limited
  try {
    const user = await requireUser()
    const { db } = await getDatabase()
    const [wallets, challenges] = await Promise.all([
      listWallets(db, user.id),
      listWalletChallenges(db, user.id),
    ])
    return json({ wallets, challenges }, { cache: 'no-store' })
  } catch (error) {
    return errorResponse(error)
  }
}

/** Link an address: stores it and returns the challenge to sign. */
export async function POST(request: NextRequest) {
  const limited = rateLimit(request)
  if (limited) return limited
  try {
    const user = await requireUser()
    const body = await readJson(request)
    const input = {
      ownerId: user.id,
      provider: stringField(body, 'provider', { required: true, max: 40 }) ?? '',
      chain: stringField(body, 'chain', { required: true, max: 40 }) ?? '',
      address: stringField(body, 'address', { required: true, max: 120 }) ?? '',
      label: stringField(body, 'label', { max: 80 }),
    }
    const { db } = await getDatabase()
    const linked = await linkWallet(db, getProviderRegistry(), input)
    return json(linked, { status: linked.challenge ? 201 : 200, cache: 'no-store' })
  } catch (error) {
    return errorResponse(error)
  }
}
