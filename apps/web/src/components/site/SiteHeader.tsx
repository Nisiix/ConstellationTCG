import Link from 'next/link'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

export type SitePage = 'home' | 'help'

/**
 * Menu of the site pages: Home, Help, and Explore — the way into the platform, so it is the one
 * button drawn in the brand color. On the landing page the hero carries that call to action, and
 * the menu's Explore steps back so one primary action is on screen at a time.
 */
export function SiteHeader({ active }: { active: SitePage }) {
  return (
    <header className="site-header">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 md:px-6">
        <Link href="/" className="focus-ring flex items-center gap-2.5 rounded-xl py-1 pr-2" aria-label="Constellation home">
          <span className="brand-orb" aria-hidden />
          <span className="serif text-[19px] text-ink">Constellation</span>
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1 md:gap-2">
          <Link href="/" className="nav-link" aria-current={active === 'home' ? 'page' : undefined}>
            Home
          </Link>
          <Link href="/help" className="nav-link" aria-current={active === 'help' ? 'page' : undefined}>
            Help
          </Link>
          <Link href="/explore" className={`btn pill ml-1 ${active === 'home' ? 'btn-ghost' : 'btn-cta'}`} title="Open the constellation">
            Explore
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
          <ThemeToggle className="ml-1" />
        </nav>
      </div>
    </header>
  )
}
