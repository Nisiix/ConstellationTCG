import Link from 'next/link'

export function SiteFooter() {
  return (
    <footer className="border-t border-ink/10">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-[13px] text-ink-dim md:flex-row md:items-center md:justify-between md:px-6">
        <div className="flex items-center gap-2.5">
          <span className="brand-orb" style={{ width: 16, height: 16 }} aria-hidden />
          <span>Constellation TCG · explore the TCG universe, follow relationships.</span>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Link href="/help" className="hover:text-ink">
            Help
          </Link>
          <Link href="/explore" className="hover:text-ink">
            Explore
          </Link>
          <a href="https://github.com/Nisiix/ConstellationTCG" className="hover:text-ink" rel="noreferrer" target="_blank">
            Source on GitHub
          </a>
          <a href="https://tcgdex.dev" className="hover:text-ink" rel="noreferrer" target="_blank">
            Card data: TCGdex
          </a>
        </nav>
      </div>
      <p className="mx-auto max-w-6xl px-4 pb-8 text-[12px] leading-relaxed text-ink-dim/80 md:px-6">
        Card names, artwork and set logos belong to their respective owners and are provided by their sources under their own
        licenses. Constellation shows no prices and sells nothing.
      </p>
    </footer>
  )
}
