import { chooseResolution } from '@constellation/ownership'
import { ValidationError, parseNodeId } from '@constellation/domain'
import type { NextRequest } from 'next/server'
import { DEFAULT_GAME } from '@/server/adapters'
import { getDatabase } from '@/server/db'
import { errorResponse, json, rateLimit, readJson, stringField } from '@/server/http'
import { requireUser } from '@/server/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * The owner's word on an ambiguous asset: `{ assetId, printingId }` pins it to a printing
 * (`card_printing:<uuid>` or a bare uuid); `{ assetId, printingId: null }` hands it back to the
 * automatic resolver.
 */
export async function POST(request: NextRequest) {
  const limited = rateLimit(request)
  if (limited) return limited
  try {
    const user = await requireUser()
    const body = await readJson(request)
    const assetId = stringField(body, 'assetId', { required: true, max: 60 }) ?? ''
    const raw = body.printingId
    let printingId: string | null = null
    if (raw !== null && raw !== undefined && raw !== '') {
      if (typeof raw !== 'string')
        throw new ValidationError('printingId must be a string or null', { status: 400 })
      const parsed = parseNodeId(raw.trim())
      if (parsed && parsed.type !== 'card_printing')
        throw new ValidationError('Only printings can be chosen', { status: 400 })
      printingId = parsed ? parsed.entityId : raw.trim()
    }
    const game = stringField(body, 'game', { max: 40 }) ?? DEFAULT_GAME
    const { db } = await getDatabase()
    const result = await chooseResolution(db, { ownerId: user.id, assetId, printingId, game })
    return json(result, { cache: 'no-store' })
  } catch (error) {
    return errorResponse(error)
  }
}
