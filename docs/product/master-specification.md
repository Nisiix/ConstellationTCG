# CONSTELLATION TCG — Master Project Specification

> **Explore the TCG universe. Follow relationships. Build your constellation.**

Version: `0.1`  
Status: `Architecture / Development Specification`  
First TCG: **Pokémon Trading Card Game**  
Target: **Web desktop-first**  
Product type: **3D semantic TCG exploration platform**

---

# 1. Vision

Constellation TCG è una piattaforma web che rappresenta l'universo di un Trading Card Game come una **costellazione tridimensionale di entità e relazioni**.

L'utente non deve percepire il prodotto come:

- un raccoglitore digitale;
- un marketplace;
- un portfolio NFT;
- un tracker di prezzi;
- un comparatore;
- un database tradizionale;
- un gioco.

Deve percepirlo come:

> **un universo navigabile in cui ogni carta è un punto e ogni relazione è una connessione.**

La piattaforma permette di:

1. cercare una carta;
2. raggiungerla nello spazio 3D;
3. esplorare le sue relazioni;
4. attraversare set, Pokémon, artisti, serie, varianti e altre entità;
5. filtrare l'universo;
6. espandere progressivamente il grafo;
7. collegare successivamente gli asset digitali posseduti;
8. visualizzare gli asset posseduti come una **My Constellation**.

---

# 2. Core Product

Il prodotto è composto da cinque livelli.

```text
┌────────────────────────────────────────────┐
│              CONSTELLATION UI              │
│                                            │
│ Search / Filters / Camera / Focus / HUD    │
└─────────────────────┬──────────────────────┘
                      │
┌─────────────────────▼──────────────────────┐
│              GRAPH ENGINE                  │
│                                            │
│ Nodes / Edges / Layout / Physics / Camera  │
└─────────────────────┬──────────────────────┘
                      │
┌─────────────────────▼──────────────────────┐
│             SEMANTIC GRAPH                 │
│                                            │
│ Cards / Sets / Artists / Entities / etc.   │
└─────────────────────┬──────────────────────┘
                      │
┌─────────────────────▼──────────────────────┐
│             CANONICAL CATALOG              │
│                                            │
│ Identity / Printing / Variant / Metadata   │
└─────────────────────┬──────────────────────┘
                      │
┌─────────────────────▼──────────────────────┐
│             DATA SOURCES                   │
│                                            │
│ TCGdex / APIs / adapters / Firecrawl       │
└────────────────────────────────────────────┘
```

In una seconda fase:

```text
DIGITAL ASSETS
      ↓
ASSET RESOLVER
      ↓
CARD PRINTING
      ↓
CARD IDENTITY
      ↓
OWNERSHIP
      ↓
MY CONSTELLATION
```

---

# 3. Product Principles

## 3.1 Exploration first

La funzione primaria è l'esplorazione.

Non:

> "Quanto vale questa carta?"

Ma:

> "Quali altre carte sono collegate a questa?"

## 3.2 Search first

L'utente deve poter iniziare senza registrazione e senza wallet.

Esempi:

```text
Charizard
Base Set
Base Set Charizard
Ken Sugimori
Scarlet & Violet
Pikachu
```

## 3.3 Semantic navigation

Ogni entità deve poter diventare un nuovo punto focale.

```text
Charizard
   ↓
Base Set
   ↓
Pokémon
   ↓
Fire Type
   ↓
Ken Sugimori
   ↓
Other Charizard printings
```

## 3.4 Progressive disclosure

Non visualizzare migliaia di nodi contemporaneamente.

```text
Universe
   ↓
Series
   ↓
Set
   ↓
Card
   ↓
Relationships
   ↓
Related entities
```

## 3.5 TCG agnostic

Pokémon è solamente il primo adapter.

```text
Pokémon
One Piece
MTG
Yu-Gi-Oh!
Lorcana
Dragon Ball
...
```

---

# 4. What Constellation Is NOT

Questi elementi sono esplicitamente fuori scope.

## No price tracker

Non introdurre:

- prezzi;
- storico prezzi;
- price alerts;
- market value;
- ROI;
- arbitraggio.

## No marketplace

Non vendiamo né acquistiamo carte.

## No portfolio

Non chiamare la sezione NFT portfolio.

Usare:

> **My Constellation**

## No binder

Non replicare una normale struttura:

```text
pagina → tasca → carta
```

## No game

Il grafo non è una meccanica di gioco.

---

# 5. Domain Model

La struttura fondamentale è:

```text
GAME
  │
  └── SERIES
        │
        └── SET
              │
              └── CARD_IDENTITY
                    │
                    └── CARD_PRINTING
                          │
                          └── DIGITAL_ASSET
                                │
                                └── OWNER
```

---

# 6. Card Identity vs Card Printing

Questa distinzione è fondamentale.

## Card Identity

Rappresenta il concetto della carta.

Esempio:

```text
Charizard
```

## Card Printing

Rappresenta una specifica manifestazione della carta.

Esempio:

```text
Charizard
Base Set
103/102
English
Holo
1999
```

Una carta può quindi avere:

```text
Charizard Identity
│
├── Base Set printing
├── Base Set 2 printing
├── Evolutions printing
├── Celebrations printing
└── ...
```

---

# 7. Canonical Database

## Core tables

```text
tcg_games
tcg_sources
tcg_series
tcg_sets
card_identities
card_printings

graph_nodes
graph_edges

digital_assets
digital_ownership

ingestion_runs
ingestion_errors
```

Future:

```text
entities
artists
mechanics
card_attributes
external_ids
asset_resolution_candidates
source_snapshots
```

---

# 8. Core Data Structures

## tcg_games

```text
id
slug
name
publisher
active
adapter_key
created_at
updated_at
```

## tcg_sources

```text
id
game_id
name
type
base_url
version
priority
enabled
last_sync_at
```

## tcg_series

```text
id
game_id
external_id
slug
name
release_date
logo_url
source_id
raw_hash
created_at
updated_at
```

## tcg_sets

```text
id
series_id
external_id
slug
name
release_date
symbol_url
logo_url

card_count_total
card_count_official

source_id
raw_hash

created_at
updated_at
```

## card_identities

```text
id
game_id
canonical_name
normalized_name
entity_type
description
created_at
updated_at
```

## card_printings

```text
id
identity_id
set_id

external_id

collector_number
printed_number

language

rarity
variant
finish

artist_id

image_front
image_back

release_date

raw_data_hash
source_id

created_at
updated_at
```

---

# 9. External IDs

Non usare un singolo ID universale.

```text
external_ids
```

con:

```text
id
entity_type
entity_id
source
external_id
created_at
```

Esempio:

```text
TCGdex → base1-4
Scryfall → uuid
YGOPRODeck → 46986414
```

---

# 10. Source Provenance

Ogni record importato deve sapere da dove arriva.

```text
source_id
source_record_id
source_version
retrieved_at
content_hash
```

Questo consente:

- debugging;
- aggiornamenti;
- deduplicazione;
- audit;
- confronto tra fonti;
- rollback.

---

# 11. Pokémon Data Source

## Primary source

**TCGdex**

Motivazioni:

- API REST;
- GraphQL;
- cards;
- sets;
- series;
- pagination;
- filtering;
- SDK;
- multilingua;
- immagini;
- supporto Pokémon TCG Pocket.

---

# 12. TCGdex Ingestion

Non interrogare TCGdex direttamente dal browser per ogni ricerca.

Usare:

```text
TCGdex
   ↓
Scheduled ingestion
   ↓
Raw snapshot
   ↓
Normalizer
   ↓
Validator
   ↓
Canonical DB
   ↓
Graph builder
```

---

# 13. Ingestion Modes

## Full import

Utilizzato per:

- inizializzazione;
- ricostruzione;
- recovery.

## Incremental import

Utilizzato normalmente.

```text
source
 ↓
detect changed records
 ↓
normalize
 ↓
validate
 ↓
upsert
```

## Failed records

Un record non valido non deve bloccare l'intera ingestion.

```text
ingestion_errors
```

con:

```text
source
record_id
error_type
payload
message
retry_count
resolved
```

---

# 14. Ingestion Run

Ogni sincronizzazione genera:

```text
ingestion_runs
```

con:

```text
id
source_id

started_at
finished_at

status

records_seen
records_created
records_updated
records_unchanged
records_failed

duration_ms
error_summary
```

---

# 15. Data Pipeline

```text
FETCH
  ↓
RAW
  ↓
NORMALIZE
  ↓
VALIDATE
  ↓
IDENTITY RESOLUTION
  ↓
PRINTING RESOLUTION
  ↓
UPSERT
  ↓
GRAPH UPDATE
  ↓
SEARCH INDEX UPDATE
```

---

# 16. Identity Resolution

La normalizzazione non deve creare duplicati.

```text
Charizard
CHARIZARD
charizard
```

→ stessa identità.

Ma:

```text
Charizard Base Set
Charizard Evolutions
```

→ stessa `CardIdentity`, diverse `CardPrinting`.

---

# 17. Graph Model

Il database relazionale è la source of truth.

Il grafo applicativo è una rappresentazione derivata.

```text
DATABASE
   ↓
GRAPH BUILDER
   ↓
graph_nodes
graph_edges
```

Non rendere il motore grafico dipendente da un database graph proprietario nella prima fase.

---

# 18. graph_nodes

```text
id
game_id
node_type
entity_id
label
subtitle
image_url
metadata
created_at
updated_at
```

Node types:

```text
game
series
set
card_identity
card_printing
pokemon
artist
mechanic
attribute
digital_asset
```

---

# 19. graph_edges

```text
id
source_node_id
target_node_id
relationship_type
weight
direction
metadata
created_at
```

---

# 20. Universal Relationships

```text
BELONGS_TO
PART_OF
PRINTING_OF
SAME_IDENTITY
SAME_SET
SAME_SERIES
SAME_ARTIST
SAME_LANGUAGE
SAME_VARIANT
ALTERNATE_PRINTING
REPRINT_OF
RELATED_TO
EVOLUTION_OF
HAS_ATTRIBUTE
REPRESENTS_ASSET
OWNED_BY
```

---

# 21. Pokémon-specific Relationships

```text
EVOLVES_FROM
EVOLVES_TO

HAS_TYPE
HAS_ABILITY
HAS_ATTACK

WEAK_TO
RESISTS

SAME_POKEMON
SAME_EVOLUTION_LINE
```

Queste relazioni devono essere definite dall'adapter Pokémon.

---

# 22. Generic Adapter System

```ts
interface TCGAdapter {
  definition(): TCGDefinition

  listSeries(): Promise<SourceSeries[]>

  listSets(): Promise<SourceSet[]>

  listCards(): Promise<SourceCard[]>

  normalizeCard(card: SourceCard): NormalizedCard

  resolveIdentity(card: NormalizedCard): IdentityResolution

  buildRelationships(
    card: NormalizedCard
  ): GraphRelationship[]
}
```

---

# 23. Adapter Directory

```text
/adapters

  /pokemon
    adapter.ts
    manifest.ts
    normalizer.ts
    resolver.ts
    relationships.ts
    tests/

  /one-piece
    adapter.ts
    manifest.ts
    normalizer.ts
    resolver.ts
    relationships.ts
    tests/

  /mtg
    adapter.ts
    manifest.ts
    normalizer.ts
    resolver.ts
    relationships.ts
    tests/
```

---

# 24. Adding a New TCG

Obiettivo:

> Aggiungere un TCG senza modificare il core application.

Idealmente:

```text
/add adapter
/add manifest
/add tests
/run ingestion
```

Non devono essere modificati:

```text
GraphScene
SearchEngine
FilterEngine
CameraEngine
AssetResolver
WalletLayer
DatabaseCore
```

---

# 25. Schema-driven Filters

I filtri non devono essere hardcoded.

```ts
interface FilterDefinition {
  id: string
  label: string
  type: "select" | "multi" | "range" | "boolean"
  scope: "global" | "game"
  values?: FilterValue[]
  dependsOn?: string[]
}
```

---

# 26. Universal Filters

```text
TCG
Series
Set
Card Type
Rarity
Language
Artist
Variant
Finish
Relationship
Node Type
Graph Depth
Ownership
```

---

# 27. Pokémon Filters

```text
Pokémon
Type
HP
Evolution Stage
Ability
Attack
Retreat Cost
Weakness
Resistance
Regulation Mark
```

---

# 28. Future MTG Filters

```text
Color
Color Identity
Mana Value
Type
Subtype
Power
Toughness
Keyword
Format
```

---

# 29. Future One Piece Filters

```text
Color
Type
Cost
Power
Counter
Attribute
Leader
Character
Stage
```

---

# 30. Search Engine

Search must support:

```text
exact
prefix
fuzzy
semantic entity
```

Esempio:

```text
"char"
```

risultati:

```text
Charizard
Charmeleon
Charmander
```

---

# 31. Search Targets

Search across:

```text
Cards
Printings
Sets
Series
Pokémon
Artists
Mechanics
Attributes
```

---

# 32. Search Result Model

```ts
interface SearchResult {
  nodeId: string
  type: NodeType
  title: string
  subtitle?: string
  image?: string
  score: number
}
```

---

# 33. URL-addressable Exploration

Ogni focus deve essere condivisibile.

Preferenza interna:

```text
/explore?node=card_printing:xyz
```

---

# 34. Command Palette

Shortcut:

```text
Ctrl/Cmd + K
```

Comandi:

```text
Search
Go to set
Go to card
Go to artist
Expand relationships
Collapse
Reset view
Toggle filters
My Constellation
Connect wallet
```

---

# 35. 3D Experience

La UI deve sembrare un:

> **JARVIS / neural interface / scientific spatial system**

Non una classica libreria di graph visualization.

---

# 36. Rendering Stack

```text
Next.js
React
TypeScript

React Three Fiber
Three.js
Drei

d3-force-3d / custom simulation

Post-processing
Bloom
Particles
Fog
Instancing
```

WebGPU deve essere un progressive enhancement; WebGL2 rimane il fallback principale della prima release.

---

# 37. Graph Camera

Quando l'utente cerca:

```text
Charizard
```

deve accadere:

```text
SEARCH
 ↓
NODE DISCOVERY
 ↓
CAMERA FLIGHT
 ↓
FOCUS
 ↓
RELATIONSHIP REVEAL
 ↓
LOCAL CONSTELLATION
```

---

# 38. Focus Animation

Sequenza:

```text
1. camera rallenta
2. target node illumina
3. surrounding nodes fade-in
4. direct edges animate
5. labels appear
6. focus panel opens
```

Target:

```text
400–900ms
```

---

# 39. Semantic Camera

Ogni relazione può diventare una navigazione.

```text
Charizard
   │
   └── Artist
         │
         └── Mitsuhiro Arita
```

Click:

```text
Artist
 ↓
camera follows edge
 ↓
artist cluster
```

---

# 40. Graph Expansion

Default:

```text
focus node
+
direct relationships
```

Expand:

```text
depth 1
depth 2
depth 3
```

Non permettere depth illimitata.

---

# 41. Performance Budget

Target iniziale:

```text
Visible nodes:
100–500

Visible edges:
200–1500

Target:
60 FPS desktop

Degraded mode:
30 FPS
```

Per grandi cluster:

```text
GPU instancing
LOD
frustum culling
edge simplification
lazy loading
```

---

# 42. Universe Visualization

Quando l'utente entra senza una ricerca, non mostrare 20.000 carte.

Mostrare:

```text
Pokémon
   ↓
Series
   ↓
Sets
```

Poi:

```text
click set
 ↓
set constellation
```

Poi:

```text
click card
 ↓
card constellation
```

---

# 43. Node Hierarchy

## Level 0

```text
TCG
```

## Level 1

```text
Series
```

## Level 2

```text
Sets
```

## Level 3

```text
Cards
```

## Level 4

```text
Relationships
```

---

# 44. Card Node

Il nodo carta deve contenere:

```text
image
name
set
number
rarity
```

ma non trasformarsi in una card grid.

---

# 45. Card Focus Panel

```text
┌──────────────────────────────┐
│ CHARIZARD                    │
│ Base Set                     │
│                              │
│ [CARD IMAGE]                 │
│                              │
│ 103/102                      │
│ Holo                         │
│ Rare                         │
│                              │
│ RELATIONSHIPS                │
│                              │
│ Pokémon                      │
│ Artist                       │
│ Set                          │
│ Printings                    │
│ Evolution                    │
└──────────────────────────────┘
```

---

# 46. Ownership Layer

Ownership non modifica il grafo.

È un overlay.

```text
GLOBAL GRAPH
      +
OWNERSHIP STATE
```

---

# 47. My Constellation

Le carte possedute diventano:

```text
brighter
larger halo
particle field
ownership accent
```

Le carte non possedute:

```text
normal
dimmed
```

Il grafo resta identico.

---

# 48. Digital Asset Layer

Schema:

```text
DIGITAL ASSET
      ↓
ASSET RESOLVER
      ↓
CARD PRINTING
      ↓
CARD IDENTITY
```

Mai:

```text
NFT name
 ↓
card
```

senza verifica.

---

# 49. Digital Asset

```text
id
platform
chain
contract_address
token_id

name
metadata_uri
image_uri

attributes

raw_metadata

created_at
updated_at
```

---

# 50. Digital Ownership

```text
id

asset_id
owner_id

wallet_address

quantity

first_seen
last_seen

source
```

---

# 51. Asset Resolver

Input:

```text
DigitalAsset
```

Output:

```text
Resolved
Ambiguous
Unresolved
```

---

# 52. Matching Signals

Il resolver deve utilizzare:

```text
game
set
card number
language
variant
finish
edition
artist
image
external IDs
platform metadata
```

---

# 53. Resolver Confidence

Esempio:

```json
{
  "status": "resolved",
  "confidence": 0.992,
  "printingId": "..."
}
```

Ambiguous:

```json
{
  "status": "ambiguous",
  "confidence": 0.71,
  "candidates": [
    "...",
    "..."
  ]
}
```

Sotto una soglia configurabile:

```text
DO NOT AUTO-MATCH
```

---

# 54. Ownership Adapters

```text
DigitalOwnershipAdapter
│
├── GenericEVMAdapter
├── OpenSeaAdapter
├── SolanaAdapter
├── PhygitalsAdapter
└── PlatformSpecificAdapter
```

---

# 55. Closed Platforms

Tre categorie:

### A — On-chain

```text
wallet
 ↓
blockchain
 ↓
asset
```

### B — Platform + blockchain

```text
platform API
+
chain
```

### C — Custodial / closed

Richiede:

```text
OAuth
API
export
official integration
```

Senza uno di questi:

```text
ownership cannot be independently verified
```

---

# 56. Wallet UX

Il wallet non deve essere il protagonista.

CTA:

```text
Connect
```

ma il prodotto deve funzionare perfettamente anche senza.

Ordine:

```text
Explore
 ↓
Search
 ↓
Understand
 ↓
Connect
 ↓
Personalize
```

---

# 57. Main Layout

```text
┌──────────────────────────────────────────────────────────┐
│ CONSTELLATION                         Pokémon      ◉      │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Search cards, sets, Pokémon, artists...                 │
│                                                          │
├───────────────┐                                          │
│ FILTERS       │                                          │
│               │                                          │
│ Series        │              3D CONSTELLATION            │
│ Set           │                                          │
│ Type          │                    ◉                     │
│ Rarity        │              ╱────┼────╲                 │
│ Artist        │            •      ◉      •               │
│ Language      │                   │                      │
│               │                   •                      │
│               │                                          │
├───────────────┴──────────────────────────────────────────┤
│ Focus: Charizard                  14 relationships        │
└──────────────────────────────────────────────────────────┘
```

---

# 58. Visual Language

Palette:

```text
near-black
deep blue
cyan
electric blue
white
soft violet
```

Uso:

```text
background → almost black
primary → cyan
secondary → blue
ownership → unique accent
inactive → low opacity
```

---

# 59. Typography

Utilizzare una sans moderna e leggibile.

Priorità:

1. leggibilità;
2. gerarchia;
3. minimalismo.

Il futuristic feeling deve derivare soprattutto da:

- spatial UI;
- light;
- motion;
- depth;
- typography spacing.

---

# 60. Glass UI

Pannelli:

```text
backdrop blur
semi-transparent surface
1px subtle border
soft shadow
```

Evitare:

```text
heavy dashboard cards
excessive rounded rectangles
```

---

# 61. Accessibility

La UI 3D non può essere l'unico modo di utilizzare il prodotto.

Prevedere:

```text
keyboard navigation
focus states
ARIA labels
reduced motion
screen-reader search results
2D fallback/list mode
```

---

# 62. 2D Fallback

Se:

```text
WebGL unavailable
low GPU
accessibility mode
reduced motion
```

mostrare:

```text
semantic 2D relationship view
```

---

# 63. Responsive Strategy

Desktop:

```text
full 3D
```

Tablet:

```text
reduced graph
```

Mobile:

```text
2D-first / lightweight 3D
```

La prima versione resta desktop-first.

---

# 64. API Architecture

```text
Browser
   ↓
Next.js API
   ↓
Application Services
   ↓
PostgreSQL
```

API categories:

```text
/search
/catalog
/graph
/sets
/series
/cards
/entities
/filters
/ownership
/assets
```

---

# 65. Graph API

```http
GET /api/graph/focus/:nodeId
```

Parameters:

```text
depth
relationshipTypes
filters
limit
```

Response:

```json
{
  "focus": {},
  "nodes": [],
  "edges": [],
  "meta": {
    "depth": 2,
    "truncated": false
  }
}
```

---

# 66. Search API

```http
GET /api/search?q=charizard
```

Parameters:

```text
game
type
limit
```

---

# 67. Filters API

```http
GET /api/filters?game=pokemon
```

---

# 68. Caching

Cache:

```text
search
sets
series
graph neighborhoods
card details
filters
```

Non interrogare continuamente le fonti esterne.

---

# 69. External API Rule

External API calls dovrebbero avvenire in:

```text
ingestion workers
```

non nel normale user interaction path.

Eccezione:

```text
digital ownership refresh
```

quando una query live è necessaria.

---

# 70. Firecrawl

Firecrawl è utilizzato principalmente per:

```text
source discovery
documentation discovery
web-only catalog sources
structured extraction
schema changes
source monitoring
```

Non per:

```text
every card search
```

Le API stabili devono essere ingerite direttamente.

---

# 71. Firecrawl Workflow

```text
discover source
      ↓
Firecrawl
      ↓
inspect structure
      ↓
adapter
      ↓
normalized data
      ↓
tests
```

Per fonti web-only:

```text
Firecrawl
 ↓
structured extraction
 ↓
validation
 ↓
snapshot
 ↓
normalization
```

---

# 72. Database Strategy

Recommended:

```text
PostgreSQL
```

Per la prima versione è preferibile a un database graph dedicato.

Vantaggi:

- transactional integrity;
- migrations mature;
- ownership relations semplici;
- indexing;
- ingestion semplice;
- minore complessità operativa.

---

# 73. Supabase Option

Supabase può essere utilizzato come layer PostgreSQL/Auth **solo dopo aver selezionato esplicitamente un progetto dedicato a Constellation**.

Non utilizzare progetti esistenti non pertinenti.

Se selezionato:

```text
Auth
Postgres
Storage
Edge Functions
```

---

# 74. Security

Mai esporre:

```text
service_role
private API keys
provider secrets
database credentials
```

Browser:

```text
public/publishable key only
```

Backend:

```text
secrets
```

---

# 75. User Accounts

Anonymous:

```text
search
explore
filter
view cards
```

Authenticated:

```text
save preferences
connect ownership
My Constellation
```

Future:

```text
saved explorations
custom constellations
shared views
```

---

# 76. Privacy

Ownership information è privata per default.

Non esporre pubblicamente:

```text
wallet address
asset inventory
ownership mapping
```

senza consenso esplicito.

---

# 77. Testing Philosophy

Ogni modifica logica deve seguire:

```text
CHANGE
 ↓
TEST
 ↓
IMPLEMENT
 ↓
TEST
 ↓
TYPECHECK
 ↓
BUILD
```

---

# 78. Required Test Layers

## Unit

```text
normalizers
identity resolution
printing resolution
asset resolver
filter definitions
relationship generation
```

## Integration

```text
ingestion
database
search
graph API
```

## E2E

```text
search card
focus card
expand graph
filter
navigation
ownership overlay
```

---

# 79. Regression Requirement

Una modifica non è completa se altera involontariamente il comportamento esistente.

Ogni bug scoperto deve ricevere un regression test.

---

# 80. Test Examples

## Normalization

```text
Input:
TCGdex Charizard Base Set

Expected:
identity = Charizard
set = Base Set
collectorNumber = 4/102
printing != identity
```

## Resolver

```text
asset:
  name = Charizard
  set = Base Set
  number = 4
  language = en

expected:
  status = resolved
  confidence >= threshold
```

Ambiguous:

```text
name = Charizard
```

senza set/number:

```text
status = ambiguous
```

---

# 81. Performance Tests

Misurare:

```text
initial load
first meaningful render
graph expansion
search latency
camera transition
GPU frame time
memory usage
```

Target:

```text
search p95 < 300ms
graph API p95 < 500ms
interaction remains responsive
```

---

# 82. M0 — Foundation

Obiettivi:

```text
monorepo
TypeScript
Next.js
database schema
domain types
adapter system
test framework
3D shell
```

Deliverables:

```text
project boots
database migrations work
test runner works
3D canvas works
Pokémon adapter skeleton exists
```

---

# 83. M1 — Pokémon Catalog

Importare il catalogo Pokémon completo.

Pipeline:

```text
TCGdex
 ↓
raw
 ↓
normalize
 ↓
validate
 ↓
identity
 ↓
printing
 ↓
database
```

Deliverables:

```text
series
sets
cards
printings
images
artists
languages
provenance
```

---

# 84. M1 Tests

Validare:

```text
record counts
duplicate identities
duplicate printings
missing IDs
broken relationships
invalid sets
invalid images
```

---

# 85. M2 — Search

Implementare:

```text
card search
set search
series search
Pokémon search
artist search
fuzzy search
command palette
URL focus
```

---

# 86. M3 — Real Graph

Implementare:

```text
graph API
nodes
edges
force layout
semantic camera
focus state
animated relationships
progressive expansion
```

Questo è il primo milestone nel quale il prodotto diventa realmente riconoscibile.

---

# 87. M4 — Advanced Filters

Implementare:

```text
schema-driven filters
dependent filters
relationship filters
graph depth
node type
language
variant
```

---

# 88. M5 — My Constellation

Implementare:

```text
authentication
wallet connection
asset discovery
resolver
confidence system
ownership storage
visual ownership layer
```

---

# 89. M6 — Digital Platforms

Implementare progressivamente:

```text
Generic EVM
OpenSea
Solana
Phygitals
platform-specific integrations
```

Nessun provider deve contaminare il core.

---

# 90. M7 — Production

Implementare:

```text
RLS audit
rate limiting
caching
observability
error monitoring
source health
accessibility
performance
security
```

---

# 91. M8 — Second TCG

Primo candidato:

```text
One Piece
```

Poi:

```text
MTG
Yu-Gi-Oh!
Lorcana
```

---

# 92. Repository

```text
constellation-tcg/

├── apps/
│   └── web/
│
├── packages/
│   ├── domain/
│   ├── database/
│   ├── graph/
│   ├── search/
│   ├── filters/
│   ├── adapters/
│   ├── resolver/
│   ├── ui/
│   └── testing/
│
├── adapters/
│   ├── pokemon/
│   ├── one-piece/
│   ├── mtg/
│   └── yugioh/
│
├── workers/
│   ├── ingestion/
│   ├── graph-builder/
│   └── ownership-sync/
│
├── supabase/
│   ├── migrations/
│   └── tests/
│
├── docs/
│   ├── architecture/
│   ├── adapters/
│   ├── api/
│   └── product/
│
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/
```

---

# 93. Monorepo Principle

I package devono essere indipendentemente testabili.

Esempio:

```text
packages/domain
```

non deve importare:

```text
React
Three.js
Next.js
```

Il domain layer deve rimanere puro TypeScript.

---

# 94. Graph Package

```text
packages/graph
```

contiene:

```text
GraphNode
GraphEdge
GraphQuery
GraphLayout
GraphExpansion
GraphCameraState
```

Nessuna implementazione database-specifica nel rendering layer.

---

# 95. UI Package

Contiene:

```text
SearchBar
CommandPalette
FilterPanel
FocusPanel
TopBar
GraphHUD
NodeTooltip
LoadingState
ErrorState
```

---

# 96. 3D Package

Contiene:

```text
ConstellationCanvas
NodeRenderer
EdgeRenderer
GraphScene
CameraController
ParticleField
SelectionEffects
FocusAnimation
```

---

# 97. State Management

Separare:

```text
catalog state
graph state
UI state
camera state
ownership state
```

Non mettere tutto in un unico global store.

---

# 98. Graph State

```ts
interface GraphState {
  focusNodeId: string | null
  nodes: GraphNode[]
  edges: GraphEdge[]
  depth: number
  selectedNodeId: string | null
}
```

---

# 99. Camera State

```ts
interface CameraState {
  targetNodeId: string | null
  mode: "free" | "focus" | "follow"
  transition: "idle" | "moving"
}
```

---

# 100. Ownership State

```ts
interface OwnershipState {
  connected: boolean
  ownedNodeIds: Set<string>
  lastSyncedAt?: string
}
```

---

# 101. Error Strategy

Ogni layer deve avere errori tipizzati:

```text
SourceError
ValidationError
NormalizationError
IdentityResolutionError
GraphError
ResolverError
ProviderError
```

Non ignorare silenziosamente gli errori di ingestion.

---

# 102. Observability

Monitorare:

```text
ingestion success
ingestion failures
API latency
search latency
graph latency
resolver confidence
unresolved assets
provider failures
client crashes
GPU fallback
```

---

# 103. Source Health

Ogni fonte:

```text
healthy
degraded
failed
unknown
```

Esempio interno:

```text
TCGdex
● Healthy
Last sync: 12 min ago
```

---

# 104. Data Freshness

Il sistema deve registrare:

```text
last synchronization
```

e la provenienza di ogni dato.

Le informazioni tecniche di ingestion non devono essere necessariamente esposte all'utente.

---

# 105. Licensing

Prima del lancio pubblico verificare:

```text
card data licensing
images
logos
set symbols
artist information
third-party APIs
platform metadata
```

Non assumere:

```text
public API = unrestricted commercial rights
```

---

# 106. Image Strategy

Non fare proxy indiscriminato di tutte le immagini.

Valutare:

```text
source-hosted images
cached CDN
object storage
license
hotlink restrictions
```

Durante lo sviluppo preferire gli URL della fonte quando consentito.

---

# 107. Search Index Strategy

Inizialmente:

```text
PostgreSQL indexes
```

Solo se necessario valutare:

```text
Meilisearch
Typesense
OpenSearch
```

Non introdurre complessità prematuramente.

---

# 108. Graph Database Strategy

Inizialmente:

```text
PostgreSQL
+
graph projection
```

Solo se le query diventano un vero collo di bottiglia valutare:

```text
Neo4j
Memgraph
Apache AGE
```

---

# 109. Critical Architecture Rule

> **Il 3D graph è una visualizzazione del semantic model, non il semantic model stesso.**

Questo impedisce che la UI diventi il database.

---

# 110. Critical Product Rule

La carta non è la destinazione.

La relazione è.

Esempio:

```text
Charizard
 ↓
Base Set
 ↓
Artist
 ↓
Other works
 ↓
Same Pokémon
 ↓
Alternate printings
 ↓
Evolution
```

Questo è il vero prodotto.

---

# 111. Future Features

Dopo la validazione del core:

```text
shared constellations
public exploration links
saved views
constellation snapshots
community annotations
semantic collections
cross-TCG relationships
artist universes
Pokémon evolution maps
set timelines
card lineage
```

---

# 112. Cross-TCG Future

Eventualmente:

```text
Pokémon
       \
        \
         UNIVERSAL TCG GRAPH
        /
       /
MTG
```

Shared semantic concepts:

```text
Card
Printing
Artist
Set
Series
Mechanic
Entity
```

I concetti specifici rimangono gestiti dagli adapter.

---

# 113. Cross-TCG Example

```text
Artist
 ├── Pokémon card
 ├── MTG card
 └── One Piece card
```

Questo crea relazioni che i normali database TCG non rendono esplorabili in modo visuale.

---

# 114. Product Differentiation

La differenziazione più forte è la combinazione:

```text
Universal TCG catalog
        +
Semantic card graph
        +
3D spatial exploration
        +
Search without wallet
        +
Digital ownership mapping
        +
Personal constellation
```

Un semplice "card relationship feature" non è sufficiente come differenziazione.

---

# 115. MVP Definition

L'MVP NON è:

```text
wallet
NFTs
marketplace
all TCGs
```

L'MVP è:

```text
Pokémon
+
catalog
+
search
+
semantic graph
+
3D exploration
```

---

# 116. MVP User Journey

```text
OPEN CONSTELLATION
        ↓
Pokémon selected
        ↓
SEARCH
        ↓
"Charizard"
        ↓
CAMERA FLIES
        ↓
CHARIZARD FOCUS
        ↓
RELATED NODES APPEAR
        ↓
CLICK "BASE SET"
        ↓
CAMERA MOVES
        ↓
SET CONSTELLATION
        ↓
CLICK "ARTIST"
        ↓
ARTIST CONSTELLATION
```

No account required.

No wallet required.

No prices.

No marketplace.

---

# 117. First Vertical Slice

Prima di importare tutto il catalogo:

```text
1 set
10–50 cards
real relationships
real images
real search
real 3D graph
```

Questo permette di validare il core experience rapidamente.

---

# 118. Vertical Slice Acceptance Test

```text
[ ] open site
[ ] search Charizard
[ ] see result
[ ] camera moves to card
[ ] card image appears
[ ] set relationship appears
[ ] Pokémon relationship appears
[ ] artist relationship appears
[ ] click relationship
[ ] camera follows
[ ] expand graph
[ ] return to previous focus
```

Se questa esperienza non è convincente, non procedere ancora allo sviluppo wallet.

---

# 119. Development Sequence

```text
PHASE 0
Architecture
      ↓
PHASE 1
Vertical slice
      ↓
PHASE 2
Full Pokémon ingestion
      ↓
PHASE 3
Search
      ↓
PHASE 4
Graph engine
      ↓
PHASE 5
Advanced filters
      ↓
PHASE 6
Authentication
      ↓
PHASE 7
Digital assets
      ↓
PHASE 8
My Constellation
      ↓
PHASE 9
Second TCG
      ↓
PHASE 10
Production
```

---

# 120. Immediate Implementation Order

```text
Task 001 — Initialize monorepo
Task 002 — Create domain types
Task 003 — Create database migrations
Task 004 — Implement Pokémon adapter
Task 005 — Import a small TCGdex fixture
Task 006 — Write normalization tests
Task 007 — Write identity/printing tests
Task 008 — Build graph projection
Task 009 — Implement search
Task 010 — Implement first 3D scene
Task 011 — Implement semantic camera
Task 012 — Implement focus panel
Task 013 — Implement graph expansion
Task 014 — Import full Pokémon catalog
```

---

# 121. Agent Development Rule

Per ogni task:

```text
READ
 ↓
PLAN
 ↓
WRITE TEST
 ↓
IMPLEMENT
 ↓
RUN TEST
 ↓
TYPECHECK
 ↓
BUILD
 ↓
REPORT
```

L'agent non deve dichiarare completato un task senza eseguire le verifiche pertinenti.

---

# 122. Prompt Policy

Gli agent devono chiedere l'intervento dell'utente solo quando una decisione è realmente product-defining o irreversibile.

Richiedono input:

```text
commercial licensing choice
paid provider
new external account
new Supabase project
wallet provider with legal implications
public sharing of ownership
```

Devono invece decidere autonomamente:

```text
folder structure
test framework
normalization internals
graph algorithms
cache implementation
component decomposition
API naming
```

---

# 123. Final Architecture

```text
                         ┌─────────────────────┐
                         │   CONSTELLATION UI  │
                         │                     │
                         │ Search / Filters    │
                         │ 3D / Camera / HUD   │
                         └──────────┬──────────┘
                                    │
                         ┌──────────▼──────────┐
                         │    GRAPH ENGINE     │
                         │                     │
                         │ layout / expansion  │
                         │ semantic navigation │
                         └──────────┬──────────┘
                                    │
                         ┌──────────▼──────────┐
                         │   SEMANTIC GRAPH    │
                         │                     │
                         │ nodes / edges       │
                         └──────────┬──────────┘
                                    │
              ┌─────────────────────▼─────────────────────┐
              │              CANONICAL CATALOG            │
              │                                            │
              │ Game → Series → Set → Identity → Printing │
              └─────────────────────┬─────────────────────┘
                                    │
                     ┌──────────────▼──────────────┐
                     │       SOURCE ADAPTERS       │
                     │                             │
                     │ Pokémon / MTG / OP / YGO   │
                     └──────────────┬──────────────┘
                                    │
                    ┌───────────────▼────────────────┐
                    │         DATA SOURCES            │
                    │                                 │
                    │ TCGdex / APIs / repositories    │
                    │ Firecrawl / web sources          │
                    └─────────────────────────────────┘


                         FUTURE LAYER
                               │
                               ▼
                    ┌─────────────────────┐
                    │   DIGITAL ASSETS    │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │   ASSET RESOLVER    │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │ DIGITAL OWNERSHIP    │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │  MY CONSTELLATION   │
                    └─────────────────────┘
```

---

# 124. Strategic Conclusion

La sequenza corretta è:

```text
TCGdex
   ↓
COMPLETE POKÉMON CATALOG
   ↓
CANONICAL IDENTITY / PRINTING
   ↓
GRAPH BUILDER
   ↓
SEARCH
   ↓
3D CONSTELLATION
   ↓
RELATIONSHIP EXPLORATION
   ↓
FILTERS
   ↓
DIGITAL ASSETS
   ↓
ASSET RESOLVER
   ↓
MY CONSTELLATION
   ↓
SECOND TCG
```

## Principio finale

> **Constellation non deve diventare un'applicazione NFT con un grafo come interfaccia. Deve essere prima di tutto un motore di esplorazione semantica dei TCG, al quale successivamente viene aggiunto il concetto di proprietà digitale.**

Questa scelta mantiene il prodotto utile anche per chi non possiede alcun asset digitale e rende il wallet un'estensione naturale, anziché una barriera d'ingresso.
