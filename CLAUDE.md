# Constellation TCG — Agent Guide

> Explore the TCG universe. Follow relationships. Build your constellation.

The full product/architecture specification lives in `docs/product/master-specification.md`.
This file is the operational summary for agents working in this repository.

## What this is

A web platform that represents a Trading Card Game universe as a navigable 3D constellation of
entities and relationships. The relational database is the source of truth; the graph is a derived
projection; the 3D scene is a visualization of the graph — never the other way around.

## Hard product rules

- **No prices.** Never store, display or ingest prices, price history, market value, ROI.
  TCGdex payloads contain `pricing` and `variants_detailed[].pricing` — strip them at the source.
- **No marketplace, no binder, no "portfolio".** Owned assets are a **My Constellation** overlay.
- **Exploration first.** The relationship is the product, not the card.
- **Progressive disclosure.** Never render thousands of nodes at once; depth is bounded (max 3).
- **TCG agnostic core.** Adding a TCG means adding an adapter under `adapters/<game>/` — the core
  (graph, search, filters, camera, database) must not need changes.
- **Search works without an account or wallet.**
- **Brand colors are contours only.** A game's theme (declared by its adapter) colors rings,
  lines and borders; backgrounds are a dirty black (dark mode) or a dirty white (light mode).
- **Images always resolve.** A set or series without an image, or whose image fails to load,
  shows the game's placeholder image (`TCGDefinition.placeholderImages`; Pokémon: the Base Set logo).
- **Relationships, not stats.** Card statistics (HP, attacks, costs) stay in `attributes` as data;
  they are never entities, edges or filters. The 3D sky stays dark in both interface modes.
- **Expansions newest first** wherever sets or series are listed.

## Repository layout

```
apps/web                 Next.js app: landing (/), help (/help), explorer (/explore), API routes, 3D scene
packages/domain          Pure TypeScript domain types, errors, normalization helpers (no React/Three/Next)
packages/database        Drizzle schema, SQL migrator, client (PGlite embedded or PostgreSQL via DATABASE_URL)
packages/adapters        TCGAdapter contract + adapter registry
packages/ingestion       Fetch → raw → normalize → validate → resolve → upsert pipeline
packages/graph           Graph projection builder + neighborhood (focus) queries
packages/search          Search service (exact / prefix / fuzzy over graph nodes)
packages/filters         Schema-driven filter definitions (universal + per-game)
packages/resolver        Digital asset → card printing resolver (confidence based)
packages/ui              Shared design tokens / small UI helpers
packages/testing         Test helpers (in-memory database, fixtures)
adapters/pokemon         Pokémon adapter (TCGdex source) + fixtures
workers/ingestion        CLI: migrate + ingest (fixture or live)
workers/graph-builder    CLI: rebuild graph projection
supabase/migrations      Plain SQL migrations (Supabase CLI compatible)
docs                     Architecture, adapters, API, product docs
```

## Development workflow (mandatory per task)

```
READ → PLAN → WRITE TEST → IMPLEMENT → RUN TEST → TYPECHECK → BUILD → REPORT
```

- A task is not complete until `pnpm typecheck`, `pnpm test` (and `pnpm build` when the app is
  affected) pass. Say so explicitly in the report, with the output if something fails.
- Every discovered bug gets a regression test.
- Ingestion errors are never swallowed: they go to `ingestion_errors`.

## Commands

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e              # Playwright against the production build (run pnpm build first)
pnpm db:migrate            # apply SQL migrations to the configured database
pnpm ingest:fixture        # ingest the bundled Base Set fixture (offline)
pnpm ingest                # ingest the full Pokémon catalog from TCGdex (network)
pnpm graph:build           # rebuild graph_nodes / graph_edges
pnpm dev                   # start the web app
```

The embedded database (PGlite) is single-process: run ingestion and the web app one at a time, or
point `DATABASE_URL` at a real PostgreSQL.

## Decisions agents make alone

Folder structure, test framework, normalization internals, graph algorithms, cache implementation,
component decomposition, API naming.

## Decisions that need the user

Commercial licensing, paid providers, new external accounts, a new Supabase project, wallet
providers with legal implications, public sharing of ownership data.
