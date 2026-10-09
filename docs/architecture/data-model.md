# Data model

Migrations live in `supabase/migrations/*.sql` (plain SQL, Supabase CLI compatible) and are mirrored
by the Drizzle schema in `packages/database/src/schema.ts`. A test applies the migrations to an
embedded database and fails on any drift between the two.

## Catalog (source of truth)

```text
tcg_games ──< tcg_sources
    │
    ├──< tcg_series ──< tcg_sets ──< card_printings >── artists
    │                                      │
    ├──< card_identities ──────────────────┘
    │
    └──< entities ──< printing_entities >── card_printings
```

| Table                | Purpose                                                                                                   |
| -------------------- | --------------------------------------------------------------------------------------------------------- |
| `tcg_games`          | One row per trading card game (`slug`, `name`, `publisher`, `adapter_key`)                                |
| `tcg_sources`        | Where a game's data comes from (`tcgdex`), with priority and `last_sync_at`                               |
| `tcg_series`         | Series / blocks (`external_id`, `slug`, `name`, `release_date`, `logo_url`, provenance)                    |
| `tcg_sets`           | Sets (`symbol_url`, `logo_url`, `card_count_total`, `card_count_official`, provenance)                    |
| `card_identities`    | The concept of a card: `canonical_name`, `normalized_name`, `entity_type` (character, trainer, energy, …) |
| `card_printings`     | One concrete printing: set, `collector_number`, `printed_number`, language, rarity, variant, finish, images, `attributes` (JSON, adapter-specific), provenance |
| `artists`            | Illustrators, deduplicated by `normalized_name`                                                            |
| `entities`           | Non-card semantic entities per game: `kind` (`pokemon`, `attribute`, `mechanic`) + stable `key`           |
| `printing_entities`  | Printing ↔ entity links with the `relation` (`SAME_POKEMON`, `HAS_TYPE`, `WEAK_TO`, `RESISTS`, …)      |
| `external_ids`       | Source ids per entity (`TCGdex → base1-4`), never a single universal id                                    |

### Identity vs printing

"Charizard" is one `card_identity`; Base Set 4/102, Base Set 2, Evolutions… are `card_printings`
of it. Identity resolution normalizes names (case, accents, whitespace) so `CHARIZARD` and
`charizard` never create duplicates, while `Charizard ex` is a distinct identity. The species link
("this card shows Charizard, dex #6") is an `entities` row of kind `pokemon`, not the identity.

### Provenance

Every imported row carries `source_id` and a content hash (`raw_hash` / `raw_data_hash`) of the
stripped source record. `source_snapshots` keeps the last raw payload per record for debugging and
re-normalization; `ingestion_runs` and `ingestion_errors` record every run and every failed record.
`catalog_import_jobs` is the queue of the resumable import: one `plan` job per run (`run_id`),
one `set` job per set that changed at the source, then `graph` jobs for the projection steps, each
with its `status`, `attempts`, `payload`, `result` and `error`; `catalog_import_request`,
`catalog_import_status` and `catalog_import_retry_failed` are the SQL helpers shared by pg_cron,
the Edge Function and the CLI.

## Graph projection (derived)

| Table         | Purpose                                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------- |
| `graph_nodes` | `id` = `<node_type>:<entity_id>` (URL-addressable), `label`, `subtitle`, `image_url`, `search_text`, `metadata`, `build_id` |
| `graph_edges` | `id` = `<source>|<RELATIONSHIP>|<target>`, `weight` (layout proximity, neighbor ranking), `direction`, `metadata`, `build_id` |

`build_id` names the projection build that last wrote the row: a stepwise build upserts its rows
and, in its last step, deletes the rows of the game that carry another build's id.

Node types: `game`, `series`, `set`, `card_identity`, `card_printing`, `pokemon`, `artist`,
`mechanic`, `attribute`, `digital_asset`.

The core emits the catalog edges (`PART_OF`) and, for every card with more than one printing,
`REPRINT_OF` from each later printing to the card's first printing (by release date, then
number): one edge per reprint, so the original is the hub of all its reprints across sets.
Universal relationships are listed in `packages/domain/src/graph.ts`; adapters add their own
(Pokémon: `EVOLVES_FROM`, `HAS_TYPE`, `WEAK_TO`, `RESISTS`,
`SAME_POKEMON`, …). The core treats relationship types as opaque strings.

Card statistics (HP, attacks, retreat cost) are data on the printing (`attributes`), never
entities, edges or filters: the product explores relationships, not stats. Entities no card refers
to any more are not projected as nodes.

`metadata` on nodes holds what the UI shows without another query: set name and number on a
printing, printing counts, release dates, a representative image for artists and species, and
`imagePlaceholder: true` when `image_url` is the game's stand-in image rather than the node's own.

The projection is dropped and rebuilt per game by `pnpm graph:build`; it is deterministic for the
same catalog.

## Accounts, wallets and digital assets (My Constellation)

Accounts live in Supabase Auth; the database only knows the user id (`owner_id`, no foreign key,
so the embedded database needs no `auth` schema).

| Table                         | Role                                                                                                           |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `wallets`                     | An address linked to an account: provider (`evm`, `solana`), chain, address, the pending challenge (nonce + expiry), `verified_at`, last sync status and asset count. Unique per (owner, provider, chain, address). |
| `wallet_sync_runs`            | One row per sync: when, outcome, how many assets were seen / resolved / ambiguous / unresolved, the error if any. |
| `digital_assets`              | A token as a provider reports it (platform, chain, contract, token id, name, image, attributes, sanitised raw metadata). Unique per (platform, chain, contract, token id). Declared cards use platform `manual`. |
| `digital_ownership`           | Who holds which asset, through which wallet (`wallet_id`, cascade) or by declaration (`source = 'manual'`); `last_seen` moves on every sync and rows the address no longer holds are released. |
| `asset_resolution_candidates` | The resolver's verdict per asset: every candidate printing with its confidence, the match flagged `resolved`. |

Ownership never changes the graph: the explorer only paints the matched printings (and their
identities) in the ownership color. No table holds a price; providers' market fields are stripped
before a payload is stored.

On the hosted database, row level security lets the publishable key read the catalog and the graph,
keeps provenance private, and shows wallets and ownership to their owner only
(`20261009000002_rls_public_read.sql`, `20261009000003_accounts_wallets.sql`).
