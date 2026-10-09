import 'server-only'
import { ConstellationError } from '@constellation/domain'
import { createServerClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { loadRootEnv } from './db'

/**
 * Accounts live in Supabase Auth (email magic links). The web app talks to Auth with the
 * publishable key and the visitor's cookies; everything else (wallets, ownership) goes through
 * the application database connection, scoped by the signed-in user's id.
 */
export class AccountError extends ConstellationError {
  readonly layer = 'account'
}

export interface SupabaseConfig {
  url: string
  anonKey: string
}

export function supabaseConfig(): SupabaseConfig | null {
  loadRootEnv()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (!url || !anonKey) return null
  return { url, anonKey }
}

/** A Supabase client bound to the request's cookies; null when accounts are not configured. */
export async function createSupabaseServer(): Promise<SupabaseClient | null> {
  const config = supabaseConfig()
  if (!config) return null
  const store = await cookies()
  return createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options)
        } catch {
          // Server components cannot write cookies; route handlers can. Reads still work.
        }
      },
    },
  })
}

export function requireSupabase(): Promise<SupabaseClient> {
  return createSupabaseServer().then((client) => {
    if (!client)
      throw new AccountError('Accounts are not configured on this deployment', { status: 503 })
    return client
  })
}

export interface AccountUser {
  id: string
  email: string | null
}

export async function currentUser(): Promise<AccountUser | null> {
  const supabase = await createSupabaseServer()
  if (!supabase) return null
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return null
  return { id: data.user.id, email: data.user.email ?? null }
}

/** The signed-in user, or a 401 (503 when accounts are not configured). */
export async function requireUser(): Promise<AccountUser> {
  if (!supabaseConfig())
    throw new AccountError('Accounts are not configured on this deployment', { status: 503 })
  const user = await currentUser()
  if (!user) throw new AccountError('Sign in to use My Constellation', { status: 401 })
  return user
}

/** Where sign-in links come back to: the configured site URL, else the request's own origin. */
export function siteOrigin(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (configured) return configured.replace(/\/+$/, '')
  const url = new URL(request.url)
  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto')
  if (forwardedHost) return `${forwardedProto ?? 'https'}://${forwardedHost}`
  return url.origin
}
