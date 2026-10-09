import type { Metadata, Viewport } from 'next'
import { Figtree, Source_Serif_4 } from 'next/font/google'
import type { ReactNode } from 'react'
import { DEFAULT_THEME, themeCssText } from '@constellation/ui'
import { AuthLinkCatcher } from '@/components/AuthLinkCatcher'
import { ModeBoot } from '@/components/ModeBoot'
import { MODE_BOOT_SCRIPT } from '@/lib/mode'
import './globals.css'

/**
 * Typography: a warm, readable serif for titles and a clean, friendly sans for everything else.
 */
const sans = Figtree({ subsets: ['latin'], variable: '--font-sans-ui', display: 'swap' })
const serif = Source_Serif_4({ subsets: ['latin'], variable: '--font-serif-ui', display: 'swap', axes: ['opsz'] })

export const metadata: Metadata = {
  title: {
    default: 'Constellation TCG',
    template: '%s · Constellation TCG',
  },
  description:
    'Explore the TCG universe as a 3D constellation of cards and relationships. Search a card, fly to it, follow its connections.',
  applicationName: 'Constellation',
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: DEFAULT_THEME.modes.dark.background },
    { media: '(prefers-color-scheme: light)', color: DEFAULT_THEME.modes.light.background },
  ],
  width: 'device-width',
  initialScale: 1,
}

/**
 * The platform palette (neutral theme) for both modes is rendered on the server so the first
 * paint is already right; the inline script picks the mode before anything is drawn; the
 * explorer later overrides the variables with the selected game's palette.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`} suppressHydrationWarning>
      <head>
        <style id="theme-defaults" dangerouslySetInnerHTML={{ __html: themeCssText(DEFAULT_THEME) }} />
        <script dangerouslySetInnerHTML={{ __html: MODE_BOOT_SCRIPT }} />
      </head>
      <body className="antialiased">
        <ModeBoot />
        <AuthLinkCatcher />
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  )
}
