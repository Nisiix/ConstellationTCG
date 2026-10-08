import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import './globals.css'

export const metadata: Metadata = {
  title: 'Constellation TCG',
  description:
    'Explore the TCG universe as a 3D constellation of cards and relationships. Search a card, fly to it, follow its connections.',
  applicationName: 'Constellation',
}

export const viewport: Viewport = {
  themeColor: '#05070d',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <a href="#focus-panel" className="skip-link">
          Skip to focus panel
        </a>
        {children}
      </body>
    </html>
  )
}
