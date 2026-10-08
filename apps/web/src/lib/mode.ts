import type { ThemeMode, ThemeModePreference } from '@constellation/domain'
import { isThemeModePreference, resolveThemeMode } from '@constellation/ui'

/** Where the visitor's choice lives (per browser). Absent means "follow the system". */
export const MODE_STORAGE_KEY = 'constellation.mode'

/**
 * Runs in <head> before the first paint: sets `data-mode` on <html> from the stored preference
 * or the system setting, so pages never flash the wrong background. Kept in sync with
 * `currentMode()` below (see mode.test.ts).
 */
export const MODE_BOOT_SCRIPT = `(function(){try{var p=localStorage.getItem(${JSON.stringify(MODE_STORAGE_KEY)});var d=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;var m=p==='dark'||p==='light'?p:(d?'dark':'light');document.documentElement.setAttribute('data-mode',m);document.documentElement.style.colorScheme=m;}catch(e){}})();`

export function readModePreference(): ThemeModePreference {
  if (typeof window === 'undefined') return 'system'
  try {
    const stored = window.localStorage.getItem(MODE_STORAGE_KEY)
    return isThemeModePreference(stored) ? stored : 'system'
  } catch {
    return 'system'
  }
}

export function writeModePreference(preference: ThemeModePreference): void {
  if (typeof window === 'undefined') return
  try {
    if (preference === 'system') window.localStorage.removeItem(MODE_STORAGE_KEY)
    else window.localStorage.setItem(MODE_STORAGE_KEY, preference)
  } catch {
    // storage unavailable (private mode, blocked): the choice lasts for this page only
  }
}

export function systemPrefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return true
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/** The mode to render right now. */
export function currentMode(): ThemeMode {
  return resolveThemeMode(readModePreference(), systemPrefersDark())
}

export function applyModeToDocument(mode: ThemeMode): void {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.mode = mode
  document.documentElement.style.colorScheme = mode
}

/** Follow the operating system while the visitor has no explicit preference. */
export function subscribeSystemMode(onChange: (mode: ThemeMode) => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  const query = window.matchMedia('(prefers-color-scheme: dark)')
  const listener = () => {
    if (readModePreference() === 'system') onChange(query.matches ? 'dark' : 'light')
  }
  query.addEventListener('change', listener)
  return () => query.removeEventListener('change', listener)
}
