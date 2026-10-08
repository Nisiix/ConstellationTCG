import { eq, tcgGames, tcgSources, type Db } from '@constellation/database'
import type { SourceType, TCGDefinition } from '@constellation/domain'

export interface GameRow {
  id: string
  slug: string
  name: string
  adapterKey: string
}

export interface SourceRow {
  id: string
  gameId: string
  name: string
}

/** Make sure the game row for an adapter exists (idempotent). */
export async function ensureGame(db: Db, definition: TCGDefinition): Promise<GameRow> {
  const [existing] = await db
    .select({
      id: tcgGames.id,
      slug: tcgGames.slug,
      name: tcgGames.name,
      adapterKey: tcgGames.adapterKey,
    })
    .from(tcgGames)
    .where(eq(tcgGames.slug, definition.slug))
    .limit(1)
  if (existing) {
    if (existing.name !== definition.name || existing.adapterKey !== definition.adapterKey) {
      await db
        .update(tcgGames)
        .set({ name: definition.name, adapterKey: definition.adapterKey, updatedAt: new Date().toISOString() })
        .where(eq(tcgGames.id, existing.id))
    }
    return { ...existing, name: definition.name, adapterKey: definition.adapterKey }
  }
  const [created] = await db
    .insert(tcgGames)
    .values({
      slug: definition.slug,
      name: definition.name,
      publisher: definition.publisher,
      adapterKey: definition.adapterKey,
    })
    .returning({
      id: tcgGames.id,
      slug: tcgGames.slug,
      name: tcgGames.name,
      adapterKey: tcgGames.adapterKey,
    })
  if (!created) throw new Error(`Could not create game ${definition.slug}`)
  return created
}

export interface EnsureSourceOptions {
  name: string
  type: SourceType
  baseUrl?: string | null
  version?: string | null
}

/** Make sure a source row exists for a game (idempotent). */
export async function ensureSource(
  db: Db,
  gameId: string,
  options: EnsureSourceOptions,
): Promise<SourceRow> {
  const [inserted] = await db
    .insert(tcgSources)
    .values({
      gameId,
      name: options.name,
      type: options.type,
      baseUrl: options.baseUrl ?? null,
      version: options.version ?? null,
    })
    .onConflictDoNothing({ target: [tcgSources.gameId, tcgSources.name] })
    .returning({ id: tcgSources.id, gameId: tcgSources.gameId, name: tcgSources.name })
  if (inserted) return inserted
  const [existing] = await db
    .select({ id: tcgSources.id, gameId: tcgSources.gameId, name: tcgSources.name })
    .from(tcgSources)
    .where(eq(tcgSources.gameId, gameId))
  const match = existing && existing.name === options.name ? existing : null
  if (match) return match
  const rows = await db
    .select({ id: tcgSources.id, gameId: tcgSources.gameId, name: tcgSources.name })
    .from(tcgSources)
    .where(eq(tcgSources.gameId, gameId))
  const found = rows.find((r) => r.name === options.name)
  if (!found) throw new Error(`Could not resolve source ${options.name} for game ${gameId}`)
  return found
}
