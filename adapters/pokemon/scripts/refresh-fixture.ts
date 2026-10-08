/**
 * Refresh a committed fixture from the live TCGdex API.
 *
 *   pnpm --filter @constellation/adapter-pokemon fixture:refresh [fixtureName] [setId,setId...]
 *
 * Defaults: fixture "base1" containing set "base1" (Base Set). Payloads are stripped of prices
 * and marketplace ids before being written.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { TCGdexLiveSource, fixturesDir } from '../src/sources'

async function main() {
  const fixtureName = process.argv[2] ?? 'base1'
  const setIds = (process.argv[3] ?? fixtureName).split(',').map((s) => s.trim())
  const source = new TCGdexLiveSource({
    baseUrl: process.env.TCGDEX_BASE_URL,
    language: process.env.TCGDEX_LANGUAGE ?? 'en',
    concurrency: Number(process.env.TCGDEX_CONCURRENCY ?? 6),
  })

  console.log(`fetching sets ${setIds.join(', ')} ...`)
  const allSets = await source.fetchSets()
  const sets = allSets.filter((s) => setIds.includes(s.id))
  if (sets.length !== setIds.length) {
    const missing = setIds.filter((id) => !sets.some((s) => s.id === id))
    throw new Error(`Unknown set ids: ${missing.join(', ')}`)
  }
  const seriesIds = new Set(sets.map((s) => s.serie.id))
  const allSeries = await source.fetchSeries()
  const series = allSeries.filter((s) => seriesIds.has(s.id))

  const cards = await source.fetchCards({
    setIds,
    onProgress: (done, total) => {
      if (done % 25 === 0 || done === total) console.log(`cards ${done}/${total}`)
    },
  })

  const dir = path.join(fixturesDir(), fixtureName)
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, 'series.json'), JSON.stringify(series, null, 2) + '\n')
  await writeFile(path.join(dir, 'sets.json'), JSON.stringify(sets, null, 2) + '\n')
  await writeFile(path.join(dir, 'cards.json'), JSON.stringify(cards, null, 2) + '\n')
  await writeFile(
    path.join(dir, 'README.md'),
    [
      `# Fixture \`${fixtureName}\``,
      '',
      `Source: TCGdex (${source.language}) — sets: ${setIds.join(', ')}.`,
      `Refreshed: ${new Date().toISOString()}.`,
      '',
      'Payloads are stripped of `pricing`, `variants_detailed`, `thirdParty` and `updated`.',
      `Regenerate with \`pnpm --filter @constellation/adapter-pokemon fixture:refresh ${fixtureName}\`.`,
      '',
    ].join('\n'),
  )
  console.log(`wrote ${series.length} series, ${sets.length} sets, ${cards.length} cards to ${dir}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
