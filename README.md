# Constellation TCG

> **Explore the TCG universe. Follow relationships. Build your constellation.**

Constellation is a web platform that represents a Trading Card Game universe as a navigable
three-dimensional constellation: every card is a point, every relationship is a connection.

- Search a card, fly to it, explore its relationships.
- Traverse sets, Pokémon, artists, series, evolutions and alternate printings.
- No account, no wallet, no prices, no marketplace.

Pages: `/` (landing — Home · Help · Explore), `/help`, `/explore` (the constellation; every focus,
depth, view and filter is in the URL). Dark and light modes: each game's brand colors are used for
contours only, over a dirty black or dirty white background; the 3D sky itself always stays dark.

First TCG: **Pokémon** (source: [TCGdex](https://tcgdex.dev)). The core is TCG agnostic.

## Quick start

```bash
pnpm install
pnpm db:migrate          # creates the embedded PostgreSQL (PGlite) under .data/pglite
pnpm ingest:fixture      # imports the bundled Base Set fixture (offline, ~100 cards)
pnpm graph:build         # projects the catalog into graph nodes / edges
pnpm dev                 # http://localhost:3000
```

To import the full Pokémon catalog from TCGdex (network, several minutes):

```bash
pnpm ingest
pnpm graph:build
```

To run against a real PostgreSQL (or Supabase), set `DATABASE_URL` in `.env` (see `.env.example`).

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

## License

Source code: MIT. Card data and images are provided by their respective sources (TCGdex) and
remain subject to their licenses; verify licensing before any public launch.
