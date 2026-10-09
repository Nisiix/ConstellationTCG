/**
 * Ingestion worker CLI.
 *
 *   tsx src/main.ts migrate
 *   tsx src/main.ts ingest [--game pokemon] [--fixture base1] [--sets base1,base2] [--mode full|incremental]
 *   tsx src/main.ts catalog [--game pokemon] [--request [--full]] [--loop] [--max-ticks N]
 *
 * Without --fixture the live source (TCGdex) is used; without --sets the whole catalog is imported.
 * `catalog` drives the resumable import queue (the same one the Supabase Edge Function runs):
 * `--request` asks for an import, then one job per tick is run, all of them with `--loop`.
 */
import { getCatalogImportStatus, requestCatalogImport, runCatalogImportTick } from '@constellation/catalog-import'
import { createDatabase, runMigrations, type Database } from '@constellation/database'
import { runIngestion } from '@constellation/ingestion'
import { loadEnv, readEnv } from './env'
import { createRegistry } from './registry'

interface Args {
  command: string
  game: string
  fixture: string | null
  sets: string[] | null
  mode: 'full' | 'incremental' | 'fixture'
  request: boolean
  full: boolean
  loop: boolean
  maxTicks: number
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    command: argv[0] ?? 'ingest',
    game: 'pokemon',
    fixture: null,
    sets: null,
    mode: 'incremental',
    request: false,
    full: false,
    loop: false,
    maxTicks: 10_000,
  }
  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = () => {
      i += 1
      return argv[i]
    }
    switch (arg) {
      case '--game':
        args.game = next() ?? args.game
        break
      case '--fixture':
        args.fixture = next() ?? 'base1'
        args.mode = 'fixture'
        break
      case '--sets':
        args.sets = (next() ?? '').split(',').map((s) => s.trim()).filter(Boolean)
        break
      case '--mode': {
        const mode = next()
        if (mode === 'full' || mode === 'incremental' || mode === 'fixture') args.mode = mode
        break
      }
      case '--request':
        args.request = true
        break
      case '--full':
        args.full = true
        break
      case '--loop':
        args.loop = true
        break
      case '--max-ticks':
        args.maxTicks = Number(next() ?? args.maxTicks) || args.maxTicks
        break
      case '--':
        break
      default:
        if (arg?.startsWith('--')) console.warn(`unknown option ${arg}`)
    }
  }
  return args
}

async function openDatabase(): Promise<Database> {
  const env = readEnv()
  const database = await createDatabase({ url: env.databaseUrl, pgliteDataDir: env.pgliteDataDir })
  console.log(`database: ${database.driver}${database.driver === 'pglite' ? ` (${env.pgliteDataDir})` : ''}`)
  return database
}

async function main() {
  loadEnv()
  const args = parseArgs(process.argv.slice(2))
  const env = readEnv()
  const database = await openDatabase()
  try {
    const migrations = await runMigrations(database, { log: (m) => console.log(`migrate: ${m}`) })
    console.log(`migrations: ${migrations.applied.length} applied, ${migrations.skipped.length} already present`)
    if (args.command === 'migrate') return

    if (args.command === 'catalog') {
      await runCatalog(database, args, env)
      return
    }

    if (args.command !== 'ingest') {
      throw new Error(`unknown command "${args.command}" (expected: migrate | ingest | catalog)`)
    }

    const registry = createRegistry(env, args.fixture)
    const adapter = registry.bySlug(args.game)
    if (!adapter) throw new Error(`no adapter for game "${args.game}"`)

    console.log(
      `ingest ${args.game}: mode=${args.mode}` +
        (args.fixture ? ` fixture=${args.fixture}` : ' source=live') +
        (args.sets ? ` sets=${args.sets.join(',')}` : ''),
    )
    const started = Date.now()
    let lastLogged = 0
    const report = await runIngestion({
      database,
      adapter,
      mode: args.mode,
      source: {
        name: 'tcgdex',
        type: 'api',
        baseUrl: env.tcgdexBaseUrl ?? 'https://api.tcgdex.net/v2',
      },
      setExternalIds: args.sets ?? (args.fixture ? undefined : undefined),
      log: (message) => console.log(message),
      onProgress: (done, total) => {
        const now = Date.now()
        if (done === total || now - lastLogged > 5000) {
          lastLogged = now
          console.log(`fetch ${done}/${total} cards (${Math.round((now - started) / 1000)}s)`)
        }
      },
    })
    console.log(
      `done in ${Math.round(report.durationMs / 1000)}s — status=${report.status} ` +
        `series ${report.series.created}+${report.series.updated}/${report.series.seen}, ` +
        `sets ${report.sets.created}+${report.sets.updated}/${report.sets.seen}, ` +
        `cards ${report.cards.created}+${report.cards.updated}/${report.cards.seen}, ` +
        `errors ${report.errors}`,
    )
    if (report.status === 'failed') process.exitCode = 1
  } finally {
    await database.close()
  }
}

/** The resumable import: request (optional), then run jobs until the queue is idle. */
async function runCatalog(database: Database, args: Args, env: ReturnType<typeof readEnv>) {
  const registry = createRegistry(env, args.fixture)
  if (args.request) {
    const id = await requestCatalogImport(database.db, args.game, { full: args.full })
    console.log(id ? `requested ${args.full ? 'full ' : ''}import ${id}` : 'an import is already in progress')
  }
  const runtime = {
    database,
    registry,
    gameSlug: args.game,
    source: { name: 'tcgdex', type: 'api' as const, baseUrl: env.tcgdexBaseUrl ?? 'https://api.tcgdex.net/v2' },
    log: (message: string) => console.log(`  ${message}`),
  }
  let ticks = 0
  for (;;) {
    const result = await runCatalogImportTick(runtime)
    if (result.idle) {
      console.log(ticks === 0 ? 'queue idle: nothing to do' : 'queue idle')
      break
    }
    ticks += 1
    const step = (result.job.payload.step as { kind?: string } | undefined)?.kind
    console.log(
      `${result.job.kind}${result.job.setExternalId ? ` ${result.job.setExternalId}` : step ? ` ${step}` : ''} → ${result.outcome}` +
        ` (${Math.round(result.durationMs / 1000)}s)` +
        (result.error ? `: ${result.error}` : ''),
    )
    if (!args.loop || ticks >= args.maxTicks) break
  }
  console.log(JSON.stringify(await getCatalogImportStatus(database.db, args.game)))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
