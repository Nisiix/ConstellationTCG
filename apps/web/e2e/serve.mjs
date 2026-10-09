/**
 * Prepares a throwaway embedded database with the committed fixtures (migrate → ingest → graph) and
 * starts the production server on the given port. Used by Playwright's webServer.
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const appDir = path.resolve(here, '..')
const repoRoot = path.resolve(appDir, '../..')
const port = process.argv[2] ?? '3101'
const dataDir = path.join(appDir, '.data', 'e2e')

if (!existsSync(path.join(appDir, '.next', 'BUILD_ID'))) {
  console.error('e2e: no production build found — run `pnpm build` first')
  process.exit(1)
}

const env = { ...process.env, PGLITE_DATA_DIR: dataDir, DATABASE_URL: '' }

function run(args) {
  const result = spawnSync('pnpm', args, { cwd: repoRoot, env, stdio: 'inherit' })
  if (result.status !== 0) {
    console.error(`e2e: \`pnpm ${args.join(' ')}\` failed`)
    process.exit(result.status ?? 1)
  }
}

rmSync(dataDir, { recursive: true, force: true })
mkdirSync(dataDir, { recursive: true })
// Base Set always; Base Set 2 too when its fixture is committed (two sets: paths across sets and
// reprints). E2E_FIXTURES overrides the list.
const fixtures = (process.env.E2E_FIXTURES ?? 'base1,base2').split(',').map((f) => f.trim()).filter(Boolean)
for (const fixture of fixtures) {
  if (!existsSync(path.join(repoRoot, 'adapters', 'pokemon', 'fixtures', fixture, 'cards.json'))) {
    if (fixture === 'base1') {
      console.error('e2e: the base1 fixture is missing')
      process.exit(1)
    }
    console.warn(`e2e: fixture ${fixture} not committed, skipped`)
    continue
  }
  run(['--filter', '@constellation/worker-ingestion', 'start', '--', 'ingest', '--fixture', fixture])
}
run(['--filter', '@constellation/worker-graph-builder', 'start'])

const server = spawn(path.join(appDir, 'node_modules', '.bin', 'next'), ['start', '--port', port], {
  cwd: appDir,
  env,
  stdio: 'inherit',
})
const stop = () => server.kill('SIGTERM')
process.on('SIGTERM', stop)
process.on('SIGINT', stop)
server.on('exit', (code) => process.exit(code ?? 0))
