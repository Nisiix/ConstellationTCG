import type { Metadata, Viewport } from 'next'
import { Figtree, Source_Serif_4 } from 'next/font/google'
import type { ReactNode } from 'react'
import './globals.css'

/**
 * Typography in the spirit of Claude's interface: a warm, readable serif for titles and a clean,
 * friendly sans for everything else.
 */
const sans = Figtree({ subsets: ['latin'], variable: '--font-sans-ui', display: 'swap' })
const serif = Source_Serif_4({ subsets: ['latin'], variable: '--font-serif-ui', display: 'swap', axes: ['opsz'] })

export const metadata: Metadata = {
  title: 'Constellation TCG',
  description:
    'Explore the TCG universe as a 3D constellation of cards and relationships. Search a card, fly to it, follow its connections.',
  applicationName: 'Constellation',
}

export const viewport: Viewport = {
  themeColor: '#09070a',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body className="antialiased">
        <a href="#focus-panel" className="skip-link">
          Skip to focus panel
        </a>
        {children}
      </body>
    </html>
  )
}
