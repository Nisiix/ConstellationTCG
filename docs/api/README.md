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
variant, finish, card type, relationship, node type, graph depth, ownership) followed by the game's
own (Pokémon: species, type, evolution stage, ability, weakness, resistance, regulation mark —
card statistics such as HP, attacks and costs are deliberately not filters). Values and ranges are computed from the catalog and cached.

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

## URL-addressable exploration

The explorer itself is addressable: `/explore?node=card_printing:<uuid>&depth=2&view=list&f.rarity=Rare`.
Every focus, depth, view mode and filter selection is in the URL, so any view can be shared.
