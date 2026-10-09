import type { Metadata } from 'next'
import Link from 'next/link'
import { ONE_PIECE_THEME } from '@constellation/ui'
import { universeUrl } from '@/lib/api'
import { ConstellationArt } from '@/components/site/ConstellationArt'
import { SiteFooter } from '@/components/site/SiteFooter'
import { SiteHeader } from '@/components/site/SiteHeader'
import { getRegistry } from '@/server/adapters'

export const metadata: Metadata = {
  title: 'Constellation TCG — explore the TCG universe',
  description:
    'Every card is a point, every relationship a line. Search a card, fly to it in 3D and follow its connections: sets, Pokémon, artists, evolutions, printings. No account, no prices.',
}

const STEPS = [
  {
    title: 'Search',
    text: 'Type a card, a set, a Pokémon or an artist. “Charizard”, “Base Set”, “Mitsuhiro Arita”: all of them are points in the same sky.',
    role: 'primary',
  },
  {
    title: 'Fly',
    text: 'The camera travels to what you found and its connections light up around it: direct ones first, then wider when you ask.',
    role: 'accent',
  },
  {
    title: 'Follow',
    text: 'Click any connection and it becomes the new focus. The set, the artist, the evolution line, the other printings: the relationship is the product.',
    role: 'contrast',
  },
] as const

const CONNECTIONS = ['Set', 'Series', 'Evolves from', 'Printings', 'Reprints', 'Pokémon', 'Artist', 'Type']

const PRINCIPLES = [
  { title: 'Exploration first', text: 'Not “what is this card worth?” but “what is this card connected to?”.' },
  { title: 'Search without an account', text: 'No sign-up, no wallet. Open the site and start looking around.' },
  { title: 'No prices, no marketplace', text: 'Nothing is for sale here and no value is shown, ever.' },
  { title: 'One sky, many games', text: 'The core is game-agnostic: a trading card game is an adapter. Pokémon is the first.' },
]

function brandTone(hex: string) {
  return { ['--brand' as string]: hex }
}

export default function HomePage() {
  const games = getRegistry()
    .list()
    .map((adapter) => adapter.definition())

  return (
    <>
      {/* Warm the explorer's first requests while the visitor reads: the map opens faster. */}
      <link rel="prefetch" href={universeUrl('pokemon')} as="fetch" crossOrigin="anonymous" />
      <link rel="prefetch" href="/api/games" as="fetch" crossOrigin="anonymous" />
      <link rel="prefetch" href="/api/filters?game=pokemon" as="fetch" crossOrigin="anonymous" />
      <SiteHeader active="home" />
      <main id="main">
        {/* ── hero ── */}
        <section className="hero-glow">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-14 md:grid-cols-[1.1fr_1fr] md:px-6 md:pb-24 md:pt-20">
            <div className="fade-up">
              <p className="eyebrow mb-3 flex items-center gap-2">
                <span className="dot" style={{ color: 'var(--c-brand-ink)' }} aria-hidden />
                Pokémon TCG today · more games to come
              </p>
              <h1 className="title-reveal text-[40px] leading-[1.05] md:text-[56px]">
                Explore the TCG universe.
                <br />
                Follow relationships.
                <br />
                <span style={{ color: 'var(--c-brand-ink)' }}>Build your constellation.</span>
              </h1>
              <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-ink/85">
                Every card is a point, every relationship a line. Search a card, fly to it in a three-dimensional sky, and follow what
                it is connected to: its set, the Pokémon it shows, the artist who drew it, what it evolves from.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link href="/explore" className="btn btn-cta pill text-[15px]">
                  Explore the constellation
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </Link>
                <Link href="/help" className="btn btn-ghost pill text-[15px]">
                  How it works
                </Link>
              </div>
              <ul className="stagger mt-6 flex flex-wrap gap-2" aria-label="Principles">
                {['No account', 'No prices', 'No marketplace', 'Search first'].map((item) => (
                  <li key={item} className="chip">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="panel fade-up p-3 md:p-5" aria-hidden>
              <ConstellationArt className="h-auto w-full" />
              <div className="flex items-center justify-between px-2 pb-1 pt-2 text-[12.5px] text-ink-dim">
                <span className="flex items-center gap-2">
                  <span className="dot" style={{ color: 'var(--c-brand-ink)' }} /> Charizard · Base Set
                </span>
                <span>14 connections</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── how it works ── */}
        <section className="mx-auto max-w-6xl px-4 py-14 md:px-6" aria-labelledby="how">
          <p className="eyebrow mb-2">How it works</p>
          <h2 id="how" className="serif text-[30px] leading-tight md:text-[36px]">
            Three moves, and the sky opens up.
          </h2>
          <ol className="mt-8 grid gap-8 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="feature pop-in" style={{ ['--i' as string]: i }}>
                <span
                  className="feature-mark mb-4"
                  style={{ color: step.role === 'primary' ? 'var(--c-brand-ink)' : step.role === 'accent' ? 'var(--c-accent)' : 'var(--c-contrast)' }}
                  aria-hidden
                />
                <h3 className="serif text-[22px]">
                  <span className="mr-2 text-ink-dim">{i + 1}.</span>
                  {step.title}
                </h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink/85">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ── what is connected ── */}
        <section className="mx-auto max-w-6xl px-4 py-14 md:px-6" aria-labelledby="connected">
          <div className="panel p-6 md:p-10">
            <div className="grid gap-8 md:grid-cols-[1fr_1.2fr] md:items-center">
              <div>
                <p className="eyebrow mb-2">What is connected</p>
                <h2 id="connected" className="serif text-[30px] leading-tight md:text-[34px]">
                  The card is never the destination.
                </h2>
                <p className="mt-3 text-[15px] leading-relaxed text-ink/85">
                  A card leads to its set, the set to its series, the Pokémon to every card that shows it, the artist to everything
                  they illustrated. Depth is bounded, so you always see a readable constellation, never a wall of thousands of cards.
                </p>
              </div>
              <ul className="flex flex-wrap gap-2" aria-label="Kinds of connections">
                {CONNECTIONS.map((label, i) => (
                  <li key={label} className="chip pop-in text-[13.5px]" style={{ ['--i' as string]: i }}>
                    <span
                      className="dot"
                      style={{ color: i % 3 === 0 ? 'var(--c-brand-ink)' : i % 3 === 1 ? 'var(--c-contrast)' : 'var(--c-accent)' }}
                      aria-hidden
                    />
                    {label}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ── games ── */}
        <section className="mx-auto max-w-6xl px-4 py-14 md:px-6" aria-labelledby="games">
          <p className="eyebrow mb-2">Games</p>
          <h2 id="games" className="serif text-[30px] leading-tight md:text-[36px]">
            One sky. Each game keeps its colors.
          </h2>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink/85">
            A game&apos;s brand colors are used for contours only: rings around the points, lines, borders. Backgrounds stay a dirty
            black or a dirty white, so the artwork is what shines.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {games.map((game) => (
              <article key={game.slug} className="panel flex items-start gap-4 p-5" style={brandTone(game.theme.primary)}>
                <span className="feature-mark mt-1 flex-none" style={{ color: 'var(--brand)' }} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="serif text-[22px]">{game.name.replace(' Trading Card Game', '')}</h3>
                    <span className="chip text-[11.5px]" style={{ color: 'var(--brand)', borderColor: 'color-mix(in oklab, var(--brand) 55%, transparent)' }}>
                      Available
                    </span>
                  </div>
                  <p className="mt-1 text-[14px] text-ink-dim">
                    {game.publisher ?? ''} · data from TCGdex · sets, cards, Pokémon, artists, evolutions and types.
                  </p>
                  <Link href={`/explore?game=${encodeURIComponent(game.slug)}`} className="btn btn-primary pill mt-4" style={{ ['--c-primary' as string]: 'var(--brand)' }}>
                    Explore {game.name.replace(' Trading Card Game', '')}
                  </Link>
                </div>
              </article>
            ))}
            <article className="panel flex items-start gap-4 p-5 opacity-80" style={brandTone(ONE_PIECE_THEME.primary)}>
              <span className="feature-mark mt-1 flex-none" style={{ color: 'var(--brand)' }} aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="serif text-[22px]">One Piece</h3>
                  <span className="chip text-[11.5px]">Next</span>
                </div>
                <p className="mt-1 text-[14px] text-ink-dim">
                  The second adapter. Then Magic: The Gathering, Yu-Gi-Oh!, Lorcana. Adding a game never changes the core: the graph,
                  the search, the filters and the camera are shared.
                </p>
              </div>
            </article>
          </div>
        </section>

        {/* ── principles ── */}
        <section className="mx-auto max-w-6xl px-4 py-14 md:px-6" aria-labelledby="principles">
          <p className="eyebrow mb-2">Principles</p>
          <h2 id="principles" className="serif text-[30px] leading-tight md:text-[36px]">
            What Constellation is, and is not.
          </h2>
          <ul className="mt-8 grid gap-6 sm:grid-cols-2">
            {PRINCIPLES.map((item, i) => (
              <li key={item.title} className="feature pop-in" style={{ ['--i' as string]: i }}>
                <h3 className="font-semibold text-ink">{item.title}</h3>
                <p className="mt-1 text-[15px] leading-relaxed text-ink/80">{item.text}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* ── final call ── */}
        <section className="mx-auto max-w-6xl px-4 pb-20 pt-6 md:px-6">
          <div className="panel panel-strong flex flex-col items-start justify-between gap-5 p-7 md:flex-row md:items-center md:p-9">
            <div>
              <h2 className="serif text-[28px] leading-tight">Ready? Open the constellation.</h2>
              <p className="mt-1 text-[15px] text-ink-dim">
                Start from the universe, pick a series or a set, or search straight for a card. Press <kbd>?</kbd> inside for help.
              </p>
            </div>
            <Link href="/explore" className="btn btn-cta pill flex-none text-[15px]">
              Explore
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
