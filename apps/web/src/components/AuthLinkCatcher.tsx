'use client'

import { useEffect } from 'react'
import { authCallbackRedirect } from '@/lib/auth-redirect'

/**
 * A sign-in link that Supabase sent back to the Site URL (because `/auth/callback` was not on the
 * redirect allow list) still signs the visitor in: the code is handed to the callback route.
 * Renders nothing; does nothing on ordinary visits.
 */
export function AuthLinkCatcher() {
  useEffect(() => {
    const target = authCallbackRedirect(window.location.href)
    if (target) window.location.replace(target)
  }, [])
  return null
}
