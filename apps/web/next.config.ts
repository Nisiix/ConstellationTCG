import path from 'node:path'
import type { NextConfig } from 'next'

const config: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(import.meta.dirname, '../..'),
  transpilePackages: [
    '@constellation/domain',
    '@constellation/database',
    '@constellation/adapters',
    '@constellation/adapter-pokemon',
    '@constellation/graph',
    '@constellation/search',
    '@constellation/filters',
    '@constellation/ui',
  ],
  serverExternalPackages: ['@electric-sql/pglite', 'postgres'],
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'assets.tcgdex.net' }],
  },
}

export default config
