#!/usr/bin/env node
/**
 * Rebuild docs/legal/THIRD_PARTY_NOTICES.md from `pnpm licenses list --json`.
 * Usage: pnpm licenses list --json | node scripts/third-party-notices.mjs
 */
import { writeFileSync } from 'node:fs'

const input = JSON.parse(
  await new Promise((resolve) => {
    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk) => (data += chunk))
    process.stdin.on('end', () => resolve(data))
  }),
)

const lines = [
  '# Third-party notices',
  '',
  'Open-source packages used by Constellation TCG (production and development), grouped by license,',
  'as reported by `pnpm licenses list`. Each package keeps its own license text in `node_modules`.',
  '',
  'Regenerate with: `pnpm licenses list --json` (summarised by `scripts/third-party-notices.mjs`).',
  '',
]
for (const license of Object.keys(input).sort((a, b) => input[b].length - input[a].length)) {
  const packages = input[license]
  lines.push(`## ${license} (${packages.length})`, '')
  for (const p of [...packages].sort((a, b) => a.name.localeCompare(b.name))) {
    const versions = Array.isArray(p.versions) ? p.versions.join(', ') : (p.version ?? '')
    lines.push(`- \`${p.name}\` ${versions}${p.homepage ? ` — ${p.homepage}` : ''}`)
  }
  lines.push('')
}
writeFileSync(new URL('../docs/legal/THIRD_PARTY_NOTICES.md', import.meta.url), lines.join('\n'))
