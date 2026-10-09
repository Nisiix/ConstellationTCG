# Constellation TCG

> **Explore the TCG universe. Follow relationships. Build your constellation.**

Constellation is a web platform that represents a Trading Card Game universe as a navigable
three-dimensional constellation: every card is a point, every relationship is a connection.

- Search a card, fly to it, explore its relationships.
- Traverse sets, Pokémon, artists, series, evolutions and alternate printings.
- No prices, no marketplace. Accounts and wallets are optional: **My Constellation** only colors
  the cards you own.

Pages: `/` (landing — Home · Help · Explore), `/help`, `/explore` (the constellation; every focus,
depth, view and filter is in the URL; printings and sets also answer at
`/card/pokemon/charizard-base-set-4` and `/set/pokemon/base-set`). Dark and light modes: each game's brand colors are used for
contours only, over a dirty black or dirty white background; the 3D sky itself always stays dark.

First TCG: **Pokémon** (source: [TCGdex](https://tcgdex.dev)). The core is TCG agnostic.

## Quick start

```bash
pnpm install
pnpm db:migrate          # creates the embedded PostgreSQL (PGlite) under .data/pglite
pnpm ingest:fixture      # imports the bundled Base Set fixture (offline, ~100 cards, one set only)
pnpm graph:build         # projects the catalog into graph nodes / edges
pnpm dev                 # http://localhost:3000
```

With the fixture alone every connection stays inside Base Set. To see every expansion and the
reprints of a card across sets, import the full Pokémon catalog from TCGdex (network, several
minutes):

```bash
pnpm ingest
pnpm graph:build
```

To run against a real PostgreSQL (or Supabase), set `DATABASE_URL` in `.env` (see `.env.example`).

### Hosted database (Supabase)

The dedicated Supabase project **ConstellationTCG** carries the same schema (`supabase/migrations`,
applied in order, recorded in `schema_migrations`), the Base Set seed and its graph projection, and
row level security: the catalog and the graph are readable with the publishable key, provenance
tables are private, wallets and ownership are visible to their owner only. The app itself connects
with `DATABASE_URL` (table owner, unaffected by RLS). To load the full catalog there, run the
ingestion from a networked machine against the project:

```bash
DATABASE_URL=<supabase connection string> pnpm ingest
DATABASE_URL=<supabase connection string> pnpm graph:build
```

### Accounts and wallets (My Constellation)

Accounts are Supabase Auth email links: set `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY`. In the Supabase dashboard (Authentication → URL Configuration) set
the Site URL to the public origin and add `<site>/auth/callback` (plus `http://localhost:3000/**`
for development) to the redirect allow list; until that is done, Supabase sends the link back to
the Site URL and the app forwards the code to the callback itself. `GET /api/health` reports
whether accounts are configured and which providers are usable. Signed-in visitors can:

- **link a wallet** — the address is proved by signing a short challenge (EIP-191 `personal_sign`
  on EVM, ed25519 on Solana); a browser wallet signs in one click, any other wallet can paste the
  signature;
- **sync it** — what the address holds is read through public providers (EVM chains via
  Blockscout's REST API, Solana via a DAS RPC when `SOLANA_RPC_URL` is set), every asset is matched
  to a printing by the resolver, and matches glow gold in the sky and in the lists;
- **declare cards** by hand (“I own this”) without any wallet.

Market data that providers attach to tokens is stripped before storage: the platform never holds
a price.

## Verification

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e            # Playwright, against the production build and the bundled fixture
```

The end-to-end suite starts its own server on port 3101 with a throwaway embedded database under
`apps/web/.data/e2e`. Set `PLAYWRIGHT_CHROMIUM_PATH` to use a pre-installed Chromium.

## Documentation

- [Master specification](docs/product/master-specification.md)
- [Architecture](docs/architecture/overview.md)
- [Data model](docs/architecture/data-model.md)
- [API](docs/api/README.md)
- [Adding a TCG adapter](docs/adapters/README.md)

## License, data and credits

Source code: MIT. Pokémon card data and image links come from [TCGdex](https://tcgdex.dev), used
with attribution and never resold; Pokémon, card names, artwork, set logos and symbols are
© Nintendo, Creatures Inc., GAME FREAK inc. and The Pokémon Company International. Constellation is
an unofficial, non-commercial fan project, not affiliated with or endorsed by them or by TCGdex.
Every adapter declares its credits (`TCGDefinition.attribution`), shown in the footer of every
page, in `/help#credits` and in the explorer. Details: [docs/legal/ATTRIBUTION.md](docs/legal/ATTRIBUTION.md);
open-source dependencies: [docs/legal/THIRD_PARTY_NOTICES.md](docs/legal/THIRD_PARTY_NOTICES.md).
Verify the terms before any public launch (master specification, chapter 105).
