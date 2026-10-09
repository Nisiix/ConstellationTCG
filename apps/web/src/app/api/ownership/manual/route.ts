import { declareOwnership, releaseOwnership } from '@constellation/ownership'
import type { NextRequest } from 'next/server'
import { getDatabase } from '@/server/db'
import { errorResponse, json, rateLimit, readJson, stringField } from '@/server/http'
import { requireUser } from '@/server/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** "I own this card": declare a printing without any wallet. */
export async function POST(request: NextRequest) {
  const limited = rateLimit(request)
  if (limited) return limited
  try {
    const user = await requireUser()
    const body = await readJson(request)
    const printing = stringField(body, 'printing', { required: true, max: 120 }) ?? ''
    const quantity = typeof body.quantity === 'number' ? body.quantity : undefined
    const { db } = await getDatabase()
    const result = await declareOwnership(db, { ownerId: user.id, printing, quantity })
    return json(result, { status: 201, cache: 'no-store' })
  } catch (error) {
    return errorResponse(error)
  }
}

/** Take a declared card back off the list. */
export async function DELETE(request: NextRequest) {
  const limited = rateLimit(request)
  if (limited) return limited
  try {
    const user = await requireUser()
    const body = await readJson(request)
    const printing = stringField(body, 'printing', { required: true, max: 120 }) ?? ''
    const { db } = await getDatabase()
    const removed = await releaseOwnership(db, { ownerId: user.id, printing })
    return json({ removed }, { cache: 'no-store' })
  } catch (error) {
    return errorResponse(error)
  }
}
