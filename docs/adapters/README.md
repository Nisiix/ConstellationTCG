# Adding a TCG adapter

A trading card game is an adapter under `adapters/<game>/`. The core — database, ingestion
pipeline, graph builder, neighborhood queries, search, filters, camera and scene — never changes
for a new game. The Pokémon adapter (`adapters/pokemon`) is the reference implementation.

## The contract

`packages/domain/src/adapter-contracts.ts`:

```ts
interface TCGAdapter {
  definition(): TCGDefinition
  listSeries(): Promise<SourceSeries[]>
  listSets(): Promise<SourceSet[]>
  listCards(options?: ListCardsOptions): Promise<SourceCard[]>
  normalizeCard(card: SourceCard): NormalizedCard
  resolveIdentity(card: NormalizedCard): IdentityResolution
  buildRelationships(context: RelationshipContext): GraphRelationship[]
}
```

- **`definition()`** — the manifest: `slug`, `name`, `publisher`, `adapterKey`, the relationship and
  node types the adapter emits beyond the universal set, its `filters` (schema-driven, game scope),
  its `theme` and its `placeholderImages`.
- **`listSeries` / `listSets` / `listCards`** — fetch from the source, already stripped of anything
  the product must not store (prices, marketplace ids). `listCards` accepts `setExternalIds` to
  limit the import (vertical slices, fixtures) and an `onProgress` callback.
- **`normalizeCard`** — source record → `NormalizedCard`: identity name and kind, collector and
  printed number, rarity, variant, finish, artist, images, description, adapter-specific
  `attributes` (persisted as JSON on the printing), the semantic `entities` the card references
  (species, types, mechanics…) and a content hash. Throw `NormalizationError` for records that
  cannot be normalized: they are recorded in `ingestion_errors`, never stored.
- **`resolveIdentity`** — which printings share one identity (Pokémon: same normalized name and
  the same kind of card).
- **`buildRelationships`** — the edges for one printing, from a `RelationshipContext` that already
  contains every node id it may need (no database access). Universal `PART_OF` edges (set → series
  → game) are produced by the core.

## Theme

```ts
const MY_THEME: TCGTheme = {
  id: 'my-game',
  primary: '#2e49c9',   // main brand color — contours only
  accent: '#8b6cf6',    // secondary brand color — contours only
  ownership: '#e0b25a',
  nodes: { set: 'primary', series: 'accent', card_printing: 'contrast', mechanic: 'muted' },
  edges: { BELONGS_TO: 'primary', PRINTING_OF: 'contrast' },
  modes: {
    dark: { background: '#0c0e1c', surface: 'rgba(18,21,44,0.74)', text: '…', textDim: '…', nodeFill: '…', contrast: '#f4f5ff', muted: '…', particles: '…' },
    light: { background: '#eef0f8', surface: '…', text: '…', textDim: '…', nodeFill: '…', contrast: '#141632', muted: '…', particles: '…' },
  },
}
```

Rules: brand colors are **contours** (rings, lines, borders, active states), never fills.
Backgrounds are a dirty black in dark mode and a dirty white in light mode; `contrast` is near-white
on dark and near-black on light so "white" contours stay visible in both modes. Node and edge
roles are `primary` | `accent` | `contrast` | `muted`; unknown types fall back to `muted`.
`packages/ui` exports presets (`DEFAULT_THEME`, `ONE_PIECE_THEME`) to start from.

## Placeholder images

`placeholderImages` gives one stand-in image per node type. The graph builder uses it when a set
or series has no logo or symbol at the source (and flags the node with `metadata.imagePlaceholder`);
the web app uses it again when an image fails to load, in the 3D scene and in every list.
Pokémon uses the classic Base Set logo for `game`, `series` and `set`.

## Filters

Game filters are declared, not coded:

```ts
{ id: 'pokemon.stage', label: 'Evolution stage', type: 'multi', scope: 'game', appliesTo: ['card_printing'],
  source: { kind: 'attribute', path: 'stage' } }
{ id: 'pokemon.type', label: 'Type', type: 'multi', scope: 'game', appliesTo: ['card_printing'],
  source: { kind: 'attribute', path: 'types', array: true } }
{ id: 'pokemon.ability', label: 'Ability', type: 'select', scope: 'game', appliesTo: ['card_printing'],
  source: { kind: 'entity', entityKind: 'mechanic', relation: 'HAS_ABILITY' } }
```

`source.kind` is `column` (a `card_printings` column), `attribute` (a key in the printing's JSON
attributes), `entity` (a linked entity) or `relation` (set / series / artist). The filters package
computes the available values and the SQL predicates from these declarations. Declare filters for
relationships and kinds, not for card statistics (HP, attacks, costs): those stay in `attributes`
as data to display.

## Steps

1. Create `adapters/<game>/` with `package.json` (depends on `@constellation/domain` and
   `@constellation/adapters`), `src/manifest.ts`, `src/normalizer.ts`, `src/resolver.ts`,
   `src/relationships.ts`, `src/sources.ts` (live client + fixture reader), `src/adapter.ts`.
2. Strip forbidden fields at the source (see `adapters/pokemon/src/tcgdex/strip.ts`) and make the
   normalizer refuse records that still contain them.
3. Commit a small fixture (one set) under `fixtures/<name>/` so tests and the vertical slice run
   offline. Document how to refresh it.
4. Tests: normalization (identity ≠ printing, numbers, attributes, entities), identity resolution
   (case / accents, distinct variants), relationships (every edge type), stripping, client retry.
5. Register the adapter: `workers/ingestion/src/registry.ts`, `workers/graph-builder/src/main.ts`
   and `apps/web/src/server/adapters.ts`. Add the source's image host to
   `apps/web/next.config.ts` (`images.remotePatterns`).
6. Run `pnpm db:migrate`, `pnpm ingest --game <slug> --sets <one set>`, `pnpm graph:build`, open
   `/explore?game=<slug>` and walk the vertical slice acceptance test from the master specification.

Nothing in `packages/*` or `apps/web/src/components` should need a change. If it does, the core is
missing an abstraction — fix the core, not the adapter.
