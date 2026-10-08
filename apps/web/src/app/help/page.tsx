import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteFooter } from '@/components/site/SiteFooter'
import { SiteHeader } from '@/components/site/SiteHeader'
import { HOW_IT_WORKS, SHORTCUTS } from '@/lib/help-content'

export const metadata: Metadata = {
  title: 'Help',
  description: 'How to explore Constellation TCG: search, follow connections, views, filters, sharing, keyboard shortcuts and principles.',
}

const SECTIONS = [
  { id: 'how', label: 'How it works' },
  { id: 'connections', label: 'Reading the connections' },
  { id: 'views', label: 'Views' },
  { id: 'filters', label: 'Filters and sharing' },
  { id: 'keyboard', label: 'Keyboard' },
  { id: 'data', label: 'Data and principles' },
  { id: 'faq', label: 'Questions' },
]

export default function HelpPage() {
  return (
    <>
      <SiteHeader active="help" />
      <main id="main" className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-[14rem_1fr] md:px-6 md:py-16">
        <aside className="md:sticky md:top-24 md:self-start">
          <p className="eyebrow mb-3">Help</p>
          <nav aria-label="Sections">
            <ul className="space-y-1">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="nav-link w-full justify-start px-2 py-1.5">
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <Link href="/explore" className="btn btn-cta pill mt-6 w-full">
            Explore
          </Link>
        </aside>

        <article className="prose-help fade-up max-w-3xl">
          <h1 className="text-[36px] leading-tight md:text-[44px]">Explore by following connections</h1>
          <p className="mt-3 text-[16px]">
            Constellation shows a trading card game as a sky of points and lines. A point is a card, a set, a series, a Pokémon, an
            artist, a type, an attack. A line is a relationship between two of them. You move by following lines.
          </p>

          <h2 id="how">How it works</h2>
          <ol>
            {HOW_IT_WORKS.map((step) => (
              <li key={step.title}>
                <strong>{step.title}</strong> {step.text}
              </li>
            ))}
          </ol>
          <p>
            Before any search you see the <strong>universe</strong>: the game, its series and its sets. Pick a set to see its cards;
            pick a card to see everything around it. Thousands of cards are never shown at once: depth is bounded to three steps and
            large hubs are capped, so every view stays readable.
          </p>

          <h2 id="connections">Reading the connections</h2>
          <ul>
            <li>
              <strong>Rings.</strong> Every point is outlined in the color of what it is: sets and series in the game&apos;s color,
              cards, Pokémon and artists in white, types and abilities in grey. The legend at the bottom of the map lists the
              kinds on screen.
            </li>
            <li>
              <strong>Lines</strong> are relationships and carry the same colors. Hover a point and the tooltip names its connection
              to the focus (“Set”, “Evolves from”, “Artist”…).
            </li>
            <li>
              <strong>The panel.</strong> Connections are grouped by kind. Hover a group or a row and those points light up in the
              sky while the rest fades; click to fly there. For a card, “Also printed in” lists the other expansions the same card
              appeared in, newest first.
            </li>
          </ul>

          <h2 id="views">Views</h2>
          <ul>
            <li>
              <strong>3D.</strong> The constellation itself. Drag to orbit, scroll to zoom, hover a point for its name, click it to fly
              there. The panel on the right lists the connections of the focus, grouped by kind.
            </li>
            <li>
              <strong>List.</strong> The same focus and the same connections as a readable page, with images and details. It is also
              what you get when WebGL is not available or reduced motion is on. Switch with the buttons at the bottom or <kbd>L</kbd>.
            </li>
            <li>
              <strong>Dark and light.</strong> The sun/moon button in the header switches the background between a dirty black and a
              dirty white; the game&apos;s colors stay on the contours. The choice is remembered in this browser; until you choose, the
              system setting applies.
            </li>
          </ul>

          <h2 id="filters">Filters and sharing</h2>
          <ul>
            <li>
              <strong>Depth.</strong> “Direct” shows what touches the focus; “Extended” and “Deep” also show what those connections
              are connected to. <kbd>E</kbd> goes wider, <kbd>C</kbd> back to direct connections.
            </li>
            <li>
              <strong>Filters</strong> (<kbd>F</kbd>) narrow which cards appear around the focus: set, rarity, type, evolution stage,
              ability, weakness, resistance and more. Filters depend on the game: a game adds its own.
            </li>
            <li>
              <strong>Sharing.</strong> Every view has a link. It holds the focus, the depth, the view mode and the filters: paste it
              anywhere and the other person lands exactly where you are.
            </li>
          </ul>

          <h2 id="keyboard">Keyboard</h2>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
            {SHORTCUTS.map(([key, label]) => (
              <div key={key} className="flex items-center justify-between gap-3 border-b border-ink/10 py-1.5 text-[14px]">
                <dt className="text-ink-dim">{label}</dt>
                <dd>
                  <kbd>{key.replace('⌘', '⌘ / Ctrl')}</kbd>
                </dd>
              </div>
            ))}
          </dl>

          <h2 id="data">Data and principles</h2>
          <ul>
            <li>
              <strong>Source.</strong> Pokémon card data and images come from{' '}
              <a href="https://tcgdex.dev" rel="noreferrer" target="_blank">
                TCGdex
              </a>
              . Data is imported by a background job and projected into the graph; the site never queries the source while you browse.
            </li>
            <li>
              <strong>No prices.</strong> Prices, market values and anything sold are stripped at the source and never stored, shown
              or implied.
            </li>
            <li>
              <strong>No account.</strong> Search and exploration need no sign-up and no wallet. “My Constellation”, the overlay that
              will highlight the cards you own, is a later milestone and will stay optional.
            </li>
            <li>
              <strong>Open source.</strong> The code is on{' '}
              <a href="https://github.com/Nisiix/ConstellationTCG" rel="noreferrer" target="_blank">
                GitHub
              </a>
              .
            </li>
          </ul>

          <h2 id="faq">Questions</h2>
          <ul>
            <li>
              <strong>A set shows the generic Pokémon logo.</strong> That set has no logo of its own at the source, or the image could
              not be loaded. The classic logo stands in so every set stays recognizable.
            </li>
            <li>
              <strong>Why can&apos;t I see all the cards of a big set at once?</strong> Progressive disclosure: hubs are capped so the
              scene stays readable. Use filters to narrow down, or open the list view.
            </li>
            <li>
              <strong>The 3D view is not available.</strong> Your browser or device has no WebGL, or reduced motion is on. The list view
              offers the same exploration.
            </li>
            <li>
              <strong>Other games?</strong> The core is game-agnostic: a game is an adapter. One Piece is next, then Magic: The
              Gathering, Yu-Gi-Oh! and Lorcana.
            </li>
          </ul>
        </article>
      </main>
      <SiteFooter />
    </>
  )
}
