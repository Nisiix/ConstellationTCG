/**
 * Regenerate `data/pokedex.json` (national dex number → species display name) from PokéAPI.
 *
 *   pnpm --filter @constellation/adapter-pokemon pokedex:refresh
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { prettifySpeciesSlug } from '../src/pokedex'

interface NationalDex {
  pokemon_entries: Array<{ entry_number: number; pokemon_species: { name: string } }>
}

async function main() {
  const response = await fetch('https://pokeapi.co/api/v2/pokedex/1/', {
    headers: { accept: 'application/json' },
  })
  if (!response.ok) throw new Error(`PokéAPI responded ${response.status}`)
  const dex = (await response.json()) as NationalDex
  const table: Record<string, string> = {}
  for (const entry of dex.pokemon_entries) {
    table[String(entry.entry_number)] = prettifySpeciesSlug(entry.pokemon_species.name)
  }
  const here = path.dirname(fileURLToPath(import.meta.url))
  const out = path.resolve(here, '../data/pokedex.json')
  await mkdir(path.dirname(out), { recursive: true })
  await writeFile(out, JSON.stringify(table, null, 2) + '\n')
  console.log(`wrote ${Object.keys(table).length} species to ${out}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
