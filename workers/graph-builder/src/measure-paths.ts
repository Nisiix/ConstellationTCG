/**
 * Measure the path between two points on a real catalog (ticket 08; limits from ticket 09).
 *
 *   pnpm path:measure [--game pokemon] [--pairs 100] [--seed 1]
 *
 * Uses DATABASE_URL (or the embedded database). Reports the cold load of the index, the time of
 * a full path request with the index warm (search + reading points and connections), how far the
 * searches went, how many pairs meet within 6 and within 8 steps, and how many paths only go
 * through sets and series. Exits with 1 when a limit is broken: cold ≤ 3 s, warm p95 ≤ 300 ms.
 */
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createDatabase, sql } from '@constellation/database'
import { getPath, loadPathIndex, pathIndexStamp, type PathCache } from '@constellation/graph'

const COLD_LIMIT_MS = 3000
const WARM_P95_LIMIT_MS = 300

function repoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
}

function args(argv: string[]) {
  const value = (name: string) => {
    const i = argv.indexOf(name)
    return i >= 0 ? argv[i + 1] : undefined
  }
  return { game: value('--game') ?? 'pokemon', pairs: Number(value('--pairs') ?? 100), seed: Number(value('--seed') ?? 1) }
}

function random(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function rows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[]
  return ((result as { rows?: T[] }).rows ?? []) as T[]
}

const percentile = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? 0
const ms = (n: number) => `${n.toFixed(1)} ms`

async function main() {
  const file = path.join(repoRoot(), '.env')
  if (existsSync(file)) {
    try {
      process.loadEnvFile(file)
    } catch {
      // ignore
    }
  }
  const { game, pairs, seed } = args(process.argv.slice(2))
  const dataDir = process.env.PGLITE_DATA_DIR?.trim() || '.data/pglite'
  const database = await createDatabase({
    url: process.env.DATABASE_URL,
    pgliteDataDir: path.isAbsolute(dataDir) ? dataDir : path.join(repoRoot(), dataDir),
  })
  const db = database.db
  try {
    const gameRow = rows<{ id: string }>(await db.execute(sql`select id from tcg_games where slug = ${game}`))[0]
    if (!gameRow) throw new Error(`Unknown game: ${game}`)

    // Cold: what the first request after a deploy (or a rebuild) pays.
    const heapBefore = process.memoryUsage().heapUsed
    const coldStart = performance.now()
    const stamp = await pathIndexStamp(db, gameRow.id)
    const index = await loadPathIndex(db, gameRow.id)
    const cold = performance.now() - coldStart
    const heap = (process.memoryUsage().heapUsed - heapBefore) / 1024 / 1024
    const map = new Map([[gameRow.id, { stamp, checkedAt: Date.now(), index }]])
    const cache: PathCache = { get: (id) => map.get(id), set: (id, entry) => void map.set(id, entry) }

    // Pairs of printings from different sets, reproducible from the seed.
    const membership = rows<{ p: string; s: string }>(
      await db.execute(sql`
        select e.source_node_id as p, e.target_node_id as s
        from graph_edges e join graph_nodes n on n.id = e.source_node_id
        where e.relationship_type = 'BELONGS_TO' and n.game_id = ${gameRow.id} and n.node_type = 'card_printing'
        order by e.source_node_id
      `),
    )
    if (membership.length < 2) throw new Error('Not enough printings to measure')
    const rand = random(seed)
    const chosen: Array<[string, string]> = []
    for (let guard = 0; chosen.length < pairs && guard < pairs * 50; guard += 1) {
      const a = membership[Math.floor(rand() * membership.length)]!
      const b = membership[Math.floor(rand() * membership.length)]!
      if (a.s !== b.s) chosen.push([a.p, b.p])
    }
    // A catalog with a single set (the bundled fixture): measure any two printings, and say so.
    const sameSetOnly = chosen.length === 0
    while (sameSetOnly && chosen.length < pairs) {
      const a = membership[Math.floor(rand() * membership.length)]!
      const b = membership[Math.floor(rand() * membership.length)]!
      if (a.p !== b.p) chosen.push([a.p, b.p])
    }

    const times: number[] = []
    const visited: number[] = []
    const lengths = new Map<number, number>()
    let within6 = 0
    let within8 = 0
    let catalogOnly = 0
    for (const [from, to] of chosen) {
      const start = performance.now()
      let result = await getPath(db, from, to, { cache, recheckMs: Number.POSITIVE_INFINITY })
      if (result.found) within6 += 1
      else result = await getPath(db, from, to, { maxDepth: 8, cache, recheckMs: Number.POSITIVE_INFINITY })
      times.push(performance.now() - start)
      visited.push(result.visited)
      if (!result.found) continue
      within8 += 1
      lengths.set(result.edges.length, (lengths.get(result.edges.length) ?? 0) + 1)
      const middle = result.nodes.slice(1, -1)
      if (middle.length > 0 && middle.every((n) => n.nodeType === 'set' || n.nodeType === 'series')) catalogOnly += 1
    }
    times.sort((a, b) => a - b)
    visited.sort((a, b) => a - b)
    const p95 = percentile(times, 95)

    console.log(`game ${game}: index of ${index.nodeCount} points and ${index.edgeCount} connections`)
    console.log(`cold load: ${ms(cold)} (limit ${COLD_LIMIT_MS} ms), heap ≈ ${heap.toFixed(1)} MB`)
    console.log(`warm path request over ${chosen.length} pairs ${sameSetOnly ? 'of printings (one set only: not the real measure)' : 'from different sets'}:`)
    console.log(`  p50 ${ms(percentile(times, 50))} · p95 ${ms(p95)} (limit ${WARM_P95_LIMIT_MS} ms) · max ${ms(times.at(-1) ?? 0)}`)
    console.log(`  points visited: p50 ${percentile(visited, 50)} · p95 ${percentile(visited, 95)} · max ${visited.at(-1) ?? 0}`)
    console.log(`  found within 6: ${within6}/${chosen.length} · within 8: ${within8}/${chosen.length}`)
    console.log(`  steps: ${[...lengths.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}→${v}`).join(' ')}`)
    console.log(`  only through sets and series: ${catalogOnly}/${within8}`)

    const ok = cold <= COLD_LIMIT_MS && p95 <= WARM_P95_LIMIT_MS
    console.log(ok ? 'within the accepted limits' : 'OVER the accepted limits')
    process.exitCode = ok ? 0 : 1
  } finally {
    await database.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
