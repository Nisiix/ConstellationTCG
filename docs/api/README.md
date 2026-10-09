# API

All routes live under `apps/web/src/app/api`, run on the Node.js runtime and return JSON. They read
the database only; external sources are never called during a request. Responses carry
`Cache-Control: public, max-age=30, s-maxage=300, stale-while-revalidate=60` and are also cached
in-process for a short time (data only changes when ingestion runs).

Every public route is rate limited per client (a token bucket: 60 requests burst, 20 per second
sustained; `429` with `Retry-After` beyond that) and reports its server time in a `Server-Timing`
header.

Errors have the shape `{ "error": { "layer": "graph" | "validation" | …, "message": "…", "details": {} } }`
with a matching status (400 for invalid input, 404 for unknown nodes or games, 500 otherwise).

## `GET /api/search?q=charizard`

| Param   | Default   | Notes                                                     |
| ------- | --------- | --------------------------------------------------------- |
| `q`     | required  | Up to 120 characters; empty → `{ "results": [] }`         |
| `game`  | `pokemon` | Game slug                                                 |
| `type`  | all       | Comma-separated node types (`card_identity,set,artist`)   |
| `limit` | 20        | 1–50                                                      |

Returns `{ results: SearchHit[] }`: `nodeId`, `type`, `title`, `subtitle`, `image`, `score`,
`match` (`exact` | `prefix` | `word` | `fuzzy`). Ranking: exact > prefix > word > fuzzy (pg_trgm),
with a type priority (identities and sets before printings) and a cap on printings per query.

## `GET /api/graph/focus/:nodeId`

The neighborhood around one node. `nodeId` is `<node_type>:<uuid>`, URL-encoded.

| Param               | Default | Notes                                                                 |
| ------------------- | ------- | --------------------------------------------------------------------- |
| `depth`             | 1       | 0–3 hops                                                              |
| `limit`             | 300     | Max nodes (focus included), 1–1000                                    |
| `perNode`           | 60      | Max neighbors expanded per node, best weight first                    |
| `relationshipTypes` | all     | Comma-separated                                                       |
| `nodeTypes`         | all     | Comma-separated                                                       |
| `f.<filterId>`      | —       | Schema-driven filters (see `/api/filters`), e.g. `f.pokemon.type=Fire` |

Returns a `GraphNeighborhood` plus `summary` and `filtered`:

```json
{
  "focus": { "id": "card_printing:…", "nodeType": "card_printing", "label": "Charizard", "…": "…" },
  "nodes": [],
  "edges": [],
  "meta": { "depth": 1, "truncated": false, "nodeCount": 18, "edgeCount": 17, "distances": { "card_printing:…": 0 } },
  "summary": [{ "relationshipType": "BELONGS_TO", "direction": "out", "count": 1 }],
  "filtered": false
}
```

`truncated` is true when a cap cut the result; `distances` gives the hop distance of every node.

## `GET /api/graph/universe?game=pokemon`

What a visitor sees before searching: the game node, its series and its sets (never the cards),
with `PART_OF` edges. 404 when the game has not been ingested / projected.

## `GET /api/graph/node/:nodeId`

One node and its relationship summary: `{ node, summary }`.

## `GET /api/filters?game=pokemon`

`{ game, filters: FilterDefinition[] }` — universal filters (series, set, rarity, language, artist,
variant, finish, card type, relationship, node type, graph depth) followed by the game's
own (Pokémon: species, type, evolution stage, weakness, resistance — card statistics such as HP,
attacks, abilities, costs and print marks are deliberately not filters). Values and ranges are computed from the catalog and cached.

## `GET /api/games`

The games known to the app, from the registered adapters merged with what the catalog contains:

```json
{
  "games": [
    {
      "slug": "pokemon",
      "name": "Pokémon Trading Card Game",
      "publisher": "The Pokémon Company",
      "theme": { "id": "pokemon", "primary": "#e3242b", "accent": "#f08a8f", "nodes": {}, "edges": {}, "modes": { "dark": {}, "light": {} } },
      "placeholderImages": { "game": "…/base1/logo.webp", "series": "…", "set": "…" },
      "available": true
    }
  ]
}
```

`theme` drives the explorer's colors (brand colors as contours, neutral backgrounds per mode);
`placeholderImages` is the stand-in image per node type used when a set or series has no image or
it fails to load.

## `GET /api/health`

Driver in use, per-source health (`healthy` / `degraded` / `failed` / `unknown` from the last
ingestion run and its age), graph statistics and the server time. Not cached.

## Accounts and ownership (My Constellation)

These routes need a signed-in visitor (Supabase Auth cookie) and answer `401` otherwise, or `503`
when accounts are not configured. They are never cached and never carry prices.

| Route                              | What it does                                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `GET /api/account`                 | `{ configured, user, providers }` — who is signed in and which providers (with availability) exist      |
| `POST /api/account/magic-link`     | `{ email, next? }` → sends the sign-in link (lands on `/auth/callback`, then `next`)                     |
| `POST /api/account/sign-out`       | Ends the session                                                                                        |
| `GET /api/wallets`                 | `{ wallets, challenges }` — linked wallets and the text still to sign for the unverified ones           |
| `POST /api/wallets`                | `{ provider, chain, address, label? }` → `{ wallet, challenge }` (201 when a challenge is issued)        |
| `POST /api/wallets/:id/verify`     | `{ signature }` — hex (EVM `r‖s‖v`) or base58/hex (Solana); marks the wallet verified                   |
| `POST /api/wallets/:id/sync`       | `{ game? }` → `{ summary, wallet }` — reads the address, resolves assets, releases what left            |
| `DELETE /api/wallets/:id`          | Unlinks the wallet and its ownership rows                                                               |
| `GET /api/ownership`               | `{ nodeIds, assets, counts, syncedAt }` — what to paint gold, and every owned asset with its resolution |
| `POST /api/ownership/manual`       | `{ printing, quantity? }` — declare a printing (`card_printing:<uuid>`) as owned                        |
| `DELETE /api/ownership/manual`     | `{ printing }` — take it back off the list                                                              |
| `POST /api/ownership/resolve`      | `{ assetId, printingId }` pins an ambiguous asset to a printing (kept across syncs); `printingId: null` hands it back to the resolver |

`GET /api/ownership` also carries, per ambiguous asset, up to five `candidates` (printing, set,
number, confidence) and `stats`: owned cards, points connected to them, and how many
constellations they form (owned cards sharing a set, Pokémon, artist, card or reprint line).

Providers: `evm` (Ethereum, Polygon, Base, Arbitrum One, OP Mainnet through Blockscout's public
`GET /api/v2/addresses/:address/nft`), `solana` (DAS `getAssetsByOwner`; available when
`SOLANA_RPC_URL` is set), `manual` (declared cards). Token payloads lose every market-looking key
(`price`, `exchange_rate`, `floor`, `volume`, …) before they are stored.

## URL-addressable exploration

The explorer itself is addressable: `/explore?node=card_printing:<uuid>&depth=2&view=list&f.rarity=Rare`.
Every focus, depth, view mode and filter selection is in the URL, so any view can be shared.

Printings and sets also have readable addresses that redirect to the explorer, carrying depth,
view and filters along:

- `/card/pokemon/charizard-base-set-4` — `<card name>-<set slug>-<collector number>`; the set is the
  longest known set slug ending the middle part, so multi-word names and sets both work;
- `/card/pokemon/base1-4` — the source's own id of the printing;
- `/set/pokemon/base-set` (or `/set/pokemon/base1`).

Unknown slugs land on the explorer's universe with `?missing=<slug>`. The Share button copies the
readable form for printings and sets.
