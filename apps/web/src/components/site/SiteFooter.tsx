import Link from 'next/link'
import { getRegistry } from '@/server/adapters'

/**
 * Every page ends with the credits the data requires: for each game, the source and its terms, the
 * rights holders of names, artwork and logos, and the disclaimer. Read from the adapters, so a new
 * game brings its own credits.
 */
export function SiteFooter() {
  const games = getRegistry()
    .list()
    .map((adapter) => adapter.definition())
  return (
    <footer className="border-t border-ink/10">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-[13px] text-ink-dim md:flex-row md:items-center md:justify-between md:px-6">
        <div className="flex items-center gap-2.5">
          <span className="brand-orb" style={{ width: 16, height: 16 }} aria-hidden />
          <span>Constellation TCG</span>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Link href="/help" className="hover:text-ink">
            Help
          </Link>
          <Link href="/explore" className="hover:text-ink">
            Explore
          </Link>
          <Link href="/help#credits" className="hover:text-ink">
            Data, credits and licenses
          </Link>
          <a
            href="https://github.com/Nisiix/ConstellationTCG"
            className="hover:text-ink"
            rel="noreferrer"
            target="_blank"
          >
            Source on GitHub (MIT)
          </a>
        </nav>
      </div>
      <div
        id="credits"
        className="mx-auto max-w-6xl space-y-2 px-4 pb-8 text-[12px] leading-relaxed text-ink-dim/80 md:px-6"
      >
        {games.map((game) => (
          <p key={game.slug}>
            <strong className="font-semibold text-ink-dim">
              {game.name.replace(' Trading Card Game', '')}:
            </strong>{' '}
            data and image links from{' '}
            <a
              href={game.attribution.source.url}
              rel="noreferrer"
              target="_blank"
              className="underline decoration-ink/30 underline-offset-2 hover:text-ink"
            >
              {game.attribution.source.name}
            </a>
            {game.attribution.source.license ? (
              <>
                {' '}
                (data under the{' '}
                <a
                  href={game.attribution.source.license.url}
                  rel="noreferrer"
                  target="_blank"
                  className="underline decoration-ink/30 underline-offset-2 hover:text-ink"
                >
                  {game.attribution.source.license.name}
                </a>
                , {game.attribution.source.license.notice}; images are linked, never stored)
              </>
            ) : null}
            . {game.attribution.rightsHolders} {game.attribution.disclaimer}
          </p>
        ))}
        <p>
          Code under the MIT license; the open-source packages it builds on are listed in the{' '}
          <a
            href="https://github.com/Nisiix/ConstellationTCG/blob/main/docs/legal/THIRD_PARTY_NOTICES.md"
            rel="noreferrer"
            target="_blank"
            className="underline decoration-ink/30 underline-offset-2 hover:text-ink"
          >
            third-party notices
          </a>
          . Typefaces Figtree and Source Serif 4 under the SIL Open Font License.
        </p>
      </div>
    </footer>
  )
}
