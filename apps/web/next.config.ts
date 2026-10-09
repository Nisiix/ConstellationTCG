import path from 'node:path'
import type { NextConfig } from 'next'

/**
 * Security headers. The content security policy names only what the pages actually use: the app
 * itself, card images from TCGdex, Supabase for accounts. Next.js' own boot scripts are inline, so
 * inline scripts and styles stay allowed; nothing is evaluated from strings.
 */
const supabaseOrigin = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : 'https://*.supabase.co'
  } catch {
    return 'https://*.supabase.co'
  }
})()
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://assets.tcgdex.net ${supabaseOrigin}`,
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin}`,
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
]

const config: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }]
  },
  outputFileTracingRoot: path.join(import.meta.dirname, '../..'),
  transpilePackages: [
    '@constellation/domain',
    '@constellation/database',
    '@constellation/adapters',
    '@constellation/adapter-pokemon',
    '@constellation/graph',
    '@constellation/search',
    '@constellation/filters',
    '@constellation/ownership',
    '@constellation/resolver',
    '@constellation/ui',
  ],
  serverExternalPackages: ['@electric-sql/pglite', 'postgres'],
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'assets.tcgdex.net' }],
  },
}

export default config
