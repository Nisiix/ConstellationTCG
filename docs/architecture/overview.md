# Architecture overview

> The relational database is the source of truth; the graph is a derived projection; the 3D scene
> is a visualization of the graph — never the other way around.

## Layers

```text
┌──────────────────────────────────────────────────────────────┐
│ apps/web — Next.js                                           │
│   /            landing (Home · Help · Explore)               │
│   /help        how it works, shortcuts, principles           │
│   /explore     the constellation: search, 3D scene, focus    │
│                panel, filters, list fallback                 │
│   /api/*       search, graph, filters, games, health         │
├──────────────────────────────────────────────────────────────┤
│ packages/graph · packages/search · packages/filters          │
│   neighborhood queries, universe view, ranking, SQL filters  │
├──────────────────────────────────────────────────────────────┤
│ graph_nodes / graph_edges            (derived projection)    │
│   rebuilt by workers/graph-builder from the catalog          │
├──────────────────────────────────────────────────────────────┤
│ canonical catalog                    (source of truth)       │
│   games · sources · series · sets · identities · printings   │
│   artists · entities · provenance                            │
├──────────────────────────────────────────────────────────────┤
│ packages/ingestion + adapters/<game>                         │
│   fetch → raw snapshot → normalize → validate → resolve →    │
│   upsert, errors to ingestion_errors                         │
└──────────────────────────────────────────────────────────────┘
```

## Packages

| Package                 | Role                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------ |
| `packages/domain`       | Pure TypeScript: catalog/graph/search/filter/theme types, typed errors, normalization, adapter contract |
| `packages/database`     | Drizzle schema (mirror of `supabase/migrations`), SQL migrator, PGlite / PostgreSQL client              |
| `packages/adapters`     | `AdapterRegistry`, content hashing, concurrency and retry helpers                                       |
| `packages/ingestion`    | The pipeline (`runIngestion`), bootstrap of game/source rows, zod validation                           |
| `packages/graph`        | `buildGraphProjection` (one shot) and `runGraphStep` (the same projection in bounded steps), `getNeighborhood`, `getUniverse`, `getRelationshipSummary`, stats |
| `packages/catalog-import` | The import as a queue of resumable jobs (`plan` → one `set` job per changed set → graph steps), claimed one at a time by any worker; HTTP handler for the Edge Function |
| `packages/search`       | `search()` — exact / prefix / word / fuzzy (pg_trgm) over `graph_nodes.search_text`                    |
| `packages/filters`      | Universal + per-game `FilterDefinition`s, value computation, SQL predicates, query parsing              |
| `packages/ui`           | Theme presets, `resolveTheme`, CSS variable helpers, mode resolution (framework-free)                   |
| `packages/resolver`     | Digital asset → card printing resolver: candidate lookup, confidence scoring, persisted candidates     |
| `packages/ownership`    | My Constellation: signed-challenge wallet linking, providers (Blockscout, Solana DAS, manual), sync    |
| `packages/testing`      | In-memory PGlite seeded with the Base Set fixture                                                       |
| `adapters/pokemon`      | TCGdex client, price stripping, normalizer, identity resolver, relationships, manifest, fixtures        |
| `workers/ingestion`     | CLI: `migrate`, `ingest --fixture base1`, `ingest` (live), `catalog --request --loop` (the job queue)   |
| `workers/graph-builder` | CLI: rebuild `graph_nodes` / `graph_edges`                                                             |
| `supabase/functions/catalog-import` | Edge Function: one import job per call, driven by pg_cron + pg_net, `SUPABASE_DB_URL`, token from Vault |

Dependency direction is strictly downward: `domain` imports nothing; the web app imports
everything; adapters never import the web app or the graph package.

## Data flow

1. **Ingestion** (`workers/ingestion`): the adapter lists series, sets and cards from its source;
   each raw record is snapshotted (`source_snapshots`), normalized (`NormalizedCard`), validated,
   resolved to a `card_identity` (by normalized name + kind) and upserted as a `card_printing`.
   Unchanged records (same content hash) are skipped, which makes full and incremental imports the
   same code path. Any failure is recorded in `ingestion_errors` and never aborts the run.
2. **Projection** (`workers/graph-builder`, or the graph steps of the import queue): the catalog
   becomes `graph_nodes` (one per game, series, set, identity, printing, artist, entity) and
   `graph_edges`. Universal edges (`PART_OF`, `REPRINT_OF`) come from the core; everything
   card-specific comes from the adapter's `buildRelationships`. Sets and series without an image
   get the game's placeholder image (`TCGDefinition.placeholderImages`), flagged with
   `metadata.imagePlaceholder`. The one-shot builder and the stepwise one share the composition
   code and produce the same rows; every row carries the `build_id` that wrote it, so a stepwise
   build updates the live projection in place and deletes what the catalog no longer has at the end.
   On the hosted project the whole import (series, sets, cards, projection) runs inside Supabase:
   pg_cron calls the `catalog-import` Edge Function every few seconds while jobs are queued.
3. **Exploration** (`apps/web`): the browser only talks to `/api/*` (rate limited, `Server-Timing`). The universe (game → series →
   sets) is shown before any search; a focus request returns a bounded neighborhood (depth ≤ 3,
   node and fan-out caps) plus a relationship summary; schema-driven filters narrow which printings
   may appear. Nothing calls external sources during user interaction. The client caches graph
   responses and preloads the neighborhoods of the strongest connections and of whatever is under
   the pointer; the server warms the database and the universe view at start-up
   (`instrumentation.ts`).
4. **Ownership** (later milestone): `packages/resolver` maps a digital asset's signals (name, set,
   number, language, external ids…) to a printing with a confidence; below the threshold nothing is
   auto-matched (`ambiguous` / `unresolved`). Ownership is an overlay on the graph, never a change
   to it.

## Visual system

- Colors come from the selected game's adapter (`TCGDefinition.theme`): brand colors are used for
  **contours only** (rings around points, lines, borders, active states); backgrounds are a dirty
  black (dark mode) or a dirty white (light mode). `packages/ui` flattens a theme for one mode
  (`resolveTheme`) and emits CSS variables; the root layout server-renders the neutral platform
  palette for both modes, an inline script picks the mode before the first paint, and the explorer
  overrides the variables with the game's palette while it is mounted.
- The 3D scene (React Three Fiber) always keeps its dark sky, whatever the interface mode. Every
  node is a neutral sphere wrapped in a contour shell colored by node type (two instanced meshes),
  edges are a single additive line geometry, images are discs on the camera-facing side of each
  node, drawn at the exact position and size of their sphere and shrunk to cancel perspective.
  Hovering a group or a row in the focus panel dims everything else in the scene.
- A 2D list view offers the same exploration when WebGL is unavailable or reduced motion is on.

## Hard rules

- No prices, no marketplace, no binder, no "portfolio". `pricing` and `variants_detailed` are
  stripped at the source and the normalizer refuses records that still contain them.
- Progressive disclosure: never thousands of nodes at once; depth ≤ 3; hubs capped.
- TCG agnostic core: adding a game is an adapter under `adapters/<game>/` plus one registration
  (see [Adding a TCG adapter](../adapters/README.md)). The graph, search, filters, camera and
  database never change for a new game.
- Search works without an account or wallet.
