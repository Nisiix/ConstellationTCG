/**
 * Graph builder worker.
 *
 *   tsx src/main.ts [--game pokemon]
 *
 * Rebuilds graph_nodes / graph_edges from the canonical catalog for every game that has a
 * registered adapter (or only the given one).
 */
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPokemonAdapter } from '@constellation/adapter-pokemon'
import { AdapterRegistry } from '@constellation/adapters'
import { createDatabase } from '@constellation/database'
import { buildGraphProjection, getGraphStats } from '@constellation/graph'

function repoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
}

function loadEnv(): void {
  const file = path.join(repoRoot(), '.env')
  if (!existsSync(file)) return
  try {
    process.loadEnvFile(file)
  } catch {
    // ignore malformed .env
  }
}

function parseArgs(argv: string[]): { game: string | undefined } {
  let game: string | undefined
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--game') game = argv[i + 1]
  }
  return { game }
}

async function main() {
  loadEnv()
  const args = parseArgs(process.argv.slice(2))
  const dataDir = process.env.PGLITE_DATA_DIR?.trim() || '.data/pglite'
  const database = await createDatabase({
    url: process.env.DATABASE_URL,
    pgliteDataDir: path.isAbsolute(dataDir) ? dataDir : path.join(repoRoot(), dataDir),
  })
  console.log(`database: ${database.driver}`)
  try {
    // Relationship building needs no network: the live adapter is only used for its rules.
    const registry = new AdapterRegistry().register(createPokemonAdapter())
    const report = await buildGraphProjection({
      database,
      registry,
      gameSlug: args.game,
      log: (m) => console.log(m),
    })
    for (const game of report.games) {
      console.log(
        `${game.slug}: ${game.nodes} nodes, ${game.edges} edges` +
          (game.skippedEdges ? ` (${game.skippedEdges} skipped)` : ''),
      )
    }
    const stats = await getGraphStats(database.db, args.game)
    console.log(`graph: ${stats.nodes} nodes, ${stats.edges} edges in ${Math.round(report.durationMs / 1000)}s`)
    console.log(JSON.stringify(stats.byNodeType))
  } finally {
    await database.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
