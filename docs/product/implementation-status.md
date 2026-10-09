# Stato di implementazione rispetto alla visione "TCG Constellation"

> Verifica puntuale (9 ottobre 2026) dei 24 punti dell'analisi di posizionamento e architettura
> rispetto al codice presente in questo repository. Legenda: ✅ fatto · 🟡 parziale · ❌ non fatto ·
> ➖ non è codice (decisione di prodotto / dipende da terzi).

## In sintesi

| Area                                                          | Stato | Dove                                                                   |
| ------------------------------------------------------------- | ----- | ---------------------------------------------------------------------- |
| Catalogo universale → Card Identity ≠ Card Printing           | ✅    | `packages/database` (schema), `packages/ingestion`, `adapters/pokemon` |
| Grafo semantico derivato dal catalogo                         | ✅    | `packages/graph` (builder, neighborhood, universe)                     |
| Esplorazione 3D come interfaccia primaria                     | ✅    | `apps/web/src/components/three`                                        |
| Ricerca libera (exact / prefix / word / fuzzy)                | ✅    | `packages/search`                                                      |
| Mappa pubblica senza account                                  | ✅    | `/explore`, API pubbliche con cache                                    |
| Wallet / digital asset → Asset Resolver → Card Identity       | ✅    | `packages/ownership`, `packages/resolver`                              |
| My Constellation (overlay, non portfolio)                     | ✅    | `AccountPanel`, `OwnButton`, overlay nel cielo e nelle liste           |
| Database hosted (Supabase) con RLS                            | 🟡    | schema + seed Base Set caricati; catalogo completo da importare        |
| Multi-TCG (MTG, One Piece, Yu-Gi-Oh!, …)                      | 🟡    | contratto adapter pronto; esiste solo l'adapter Pokémon                |
| Provider proprietari (Phygitals, OpenSea, Coinbase/Courtyard) | ❌    | solo provider pubblici senza chiave (Blockscout, DAS RPC, manuale)     |

## Verifica punto per punto

### 1–7 · Posizionamento e competitor

- **Posizionamento "TCG Constellation", Card Graph come motore** — ➖/✅. Il prodotto si chiama
  Constellation, la promessa è "Explore the TCG universe. Follow relationships. Build your
  constellation." (landing, README, `CLAUDE.md`). Il grafo non è venduto come feature a sé: è il
  motore dietro ricerca, navigazione e ownership, come indicato nello schema a tre rami
  (Card Graph · Ownership · Discovery → 3D Universe).
- **Differenziazione rispetto a Moxx Rocks / Mana for Cards** — ✅. Le relazioni non sono liste
  di suggerimenti ma archi tipizzati navigabili nello spazio; la collezione non è analizzata in
  una pagina ma illuminata dentro lo stesso universo.
- **Allineamento a tcg-schema (identity ≠ printing)** — ✅. `card_identities` / `card_printings`
  con `external_ids` per sorgente; il resolver lavora sulle printing e risale alle identity.
- **Non replicare il "digital binder" (DigiBinder, TCG Browser)** — ✅. Nessun binder, nessun
  raccoglitore, nessuna scansione: la regola "no binder, no portfolio" è nel `CLAUDE.md`.
- **Knowledge graph come interfaccia spaziale, non solo database** — ✅. Il grafo (`graph_nodes`,
  `graph_edges`) è una proiezione; la scena 3D ne è la visualizzazione; mai il contrario.

### 8–9 · La parte 3D "JARVIS"

- **Nessun cambio pagina: la camera vola al nodo** — ✅. `useCameraStore.flyTo` con modalità
  `focus` e `follow`; ogni nuovo vicinato innesca un volo (`Explorer.tsx`).
- **Il nodo diventa centrale, poi compaiono le connessioni** — ✅. Layout force-directed
  (`d3-force-3d`) centrato sul focus, rivelazione progressiva dei punti (`reveal` in
  `NodeRenderer`), archi con scintille animate (`EdgeSparks`), alone e anello orbitante sul focus
  (`SelectionEffects`), campo di stelle (`ParticleField`), bloom e vignette (`PostFX`).
- **Layer 1 / 2 / 3 (Direct, Extended, Deep)** — ✅. Profondità 1–3 nel HUD e nell'URL
  (`depth`), con limiti per nodo (60) e totali (300) per non degenerare a spaghetti.
- **Tipi di relazione previsti dal documento** — 🟡.
  - Presenti e usati dall'adapter Pokémon: `EVOLUTION_OF`, `SAME_POKEMON` (same character),
    `ILLUSTRATED_BY` (same artist), `PART_OF` / `BELONGS_TO` (set, serie), `PRINTING_OF`,
    `HAS_TYPE`, `WEAK_TO`, `RESISTS`, `HAS_ATTRIBUTE`. Attacchi e abilità restano dati della carta,
    mai nodi o archi.
  - Dichiarati nel core ma non ancora emessi da nessun adapter: `ALTERNATE_PRINTING`,
    `REPRINT_OF`, `SAME_VARIANT`, `RELATED_TO`, `REPRESENTS_ASSET`. "Variant" e "Related print"
    oggi si raggiungono tramite l'identità ("Also printed in", `useOtherPrintings`), non come archi
    propri.
- **Nebbia di profondità** — ❌ (dettaglio estetico; bloom, vignette, particelle e archi animati
  ci sono).

### 10–11 · La Constellation personale e l'indipendenza dal wallet

- **Il wallet non cambia il mondo, lo illumina** — ✅. `useOwnershipStore` contiene solo gli id
  dei nodi posseduti; `NodeRenderer` li colora con `theme.ownership` (oro) e li ingrandisce del
  25 %; legenda "yours", righe del pannello e chip della vista List marcati.
- **Effetti suggeriti sui nodi posseduti** — 🟡. Fatti: luminosità/colore e dimensione. Non
  fatti: particelle orbitanti, alone dedicato, archi più intensi tra nodi posseduti. L'icona
  wallet è stata deliberatamente evitata (vedi punto 21).
- **Il grafo esiste senza wallet; la mappa pubblica è completa** — ✅. Tutte le API del grafo
  sono anonime e cacheable; `/api/ownership` è l'unico overlay autenticato.
- **URL per carta del tipo `app.com/card/pokemon/charizard-base-set-4`** — 🟡. Ogni vista è
  indirizzabile e condivisibile (`/explore?node=card_printing:<uuid>&depth=2&view=list&f.…`) ma
  gli id sono UUID, non slug leggibili.
- **Statistiche "37 owned nodes · 214 connected nodes · 6 constellations"** — 🟡. Il pannello
  mostra i conteggi delle carte possedute (trovate nel cielo / da verificare / non a catalogo);
  mancano "nodi connessi" e il conteggio dei cluster ("costellazioni").

### 12–16 · Digital asset → Card Identity e Asset Resolver

- **Caso A, asset on-chain standard (contract → token → metadata)** — ✅. Provider EVM via API
  REST pubblica di Blockscout (Ethereum, Polygon, Base, Arbitrum One, OP Mainnet; nessuna chiave)
  e provider Solana via DAS `getAssetsByOwner` (richiede un RPC DAS in `SOLANA_RPC_URL`). OpenSea
  non è usato perché richiede una API key: Blockscout copre lo stesso caso senza credenziali.
- **Caso B, piattaforme con metadata proprietari (Phygitals)** — ❌. L'interfaccia
  `OwnershipProvider` e il registro permettono di aggiungere un adapter senza toccare il core, ma
  nessun adapter Phygitals esiste (API user-scoped con chiave: va verificata la disponibilità).
- **Caso C, custodial (Coinbase, Courtyard)** — ❌ / ➖. Non verificabile senza API o OAuth del
  provider; non dipende da noi. Il prodotto non ne dipende (vedi punto 24).
- **Asset Resolver con confidenza, non per nome** — ✅. `packages/resolver`: segnali game, set,
  numero, lingua, variante, finitura, artista, external id (conclusivo), con pesi; soglie
  `resolved ≥ 0.85`, `ambiguous ≥ 0.35`, altrimenti `unresolved`; candidati persistiti con
  `confidence` e `reasons`. 🟡 i segnali `edition` e `imageUri` vengono estratti ma non pesati.
- **Gli asset non risolti non entrano nel grafo come identità** — ✅. Solo lo stato `resolved`
  colora i nodi; `ambiguous` e `unresolved` restano nei conteggi del pannello. ❌ manca
  un'interfaccia per scegliere a mano il candidato giusto fra gli ambigui.
- **Verifica del controllo dell'indirizzo** — ✅ (oltre la visione): sfida firmata una tantum
  (EIP-191 `personal_sign` su EVM, ed25519 su Solana), nonce e scadenza; firma dal wallet del
  browser in un click o incollata.

### 17 · Modello dati

- **GAME → SET → CARD_IDENTITY → PRINTING → DIGITAL_ASSET (platform, contract, token, owner)**
  — ✅. `tcg_games`, `tcg_series`, `tcg_sets`, `card_identities`, `card_printings`,
  `digital_assets`, `digital_ownership` (+ `wallets`, `wallet_sync_runs`,
  `asset_resolution_candidates`).
- **VARIANT e ARTWORK come entità** — 🟡. Variante e finitura sono colonne della printing;
  l'artista è un'entità (`artists`), l'artwork è l'immagine della printing, non un'entità propria.

### 18–19 · Progressive disclosure e semantic camera

- **Zoom 0–4** — ✅. Universo (gioco → serie → set, dal più recente), set → carte, carta →
  evoluzioni / varianti (altre stampe) / artista / set / Pokémon, scheda singola con la vista
  Details e pulsante indietro.
- **Mai migliaia di nodi** — ✅. Profondità massima 3, limiti per nodo e totali, flag `truncated`
  e `filtered` mostrati nell'interfaccia.
- **Semantic camera (ricerca → fly-to → espansione dei nodi più rilevanti; click → segue il
  collegamento)** — ✅. Vicinato ordinato per peso, preload delle 8 connessioni più forti e del
  nodo sotto il puntatore, modalità `follow` quando si clicca una connessione.

### 20–22 · Tecnologia, estetica, wallet invisibile

- **React + TypeScript, Three.js, React Three Fiber, Drei, d3-force-3d, instancing, bloom,
  particelle, archi animati** — ✅ (nebbia ❌, vedi sopra).
- **Niente estetica crypto, niente terminologia token/NFT/Web3, niente numeri enormi** — ✅.
  "My Constellation", "Link a wallet", "I own this": nessun prezzo, nessun marketplace, nessun
  "portfolio"; i dati di mercato dei provider sono rimossi prima del salvataggio
  (`stripMarketData`).
- **Il wallet quasi invisibile** — ✅. Il wallet è un mezzo nel pannello, non un'identità: si può
  possedere senza wallet (carte dichiarate) e l'overlay è identico qualunque sia la fonte.

### 23–24 · Killer feature e ordine dell'MVP

- **"Follow the Card" (Pikachu → stampa → set → artista → altri Pikachu → evoluzioni → asset
  → i tuoi)** — ✅. Ogni passo è un click nella scena, nel pannello o nei chip della vista List;
  quando la catena tocca una carta posseduta, si illumina.
- **MVP indipendente dai digital asset, layer ownership aggiunto dopo come adapter** — ✅.
  È esattamente l'ordine seguito: catalogo → identity → grafo → 3D → ricerca, poi
  `packages/resolver` e `packages/ownership`; un nuovo provider è un file in
  `packages/ownership/src/providers` registrato in `registry.ts`.

## Cosa manca, in ordine di valore

1. **Catalogo Pokémon completo su Supabase** — eseguire da una macchina con rete
   `DATABASE_URL=<supabase> pnpm ingest && pnpm graph:build` (il MCP non regge l'import completo).
   Oggi il progetto hosted ha schema, RLS, hardening e il seed Base Set (102 printing, 295 nodi).
2. **Configurazione Auth nel dashboard Supabase** — Site URL pubblico e `<sito>/auth/callback`
   nella allow list dei redirect (più `http://localhost:3000/**` in sviluppo). Senza, Supabase
   rimanda al Site URL: l'app intercetta comunque il codice e completa l'accesso
   (`AuthLinkCatcher`), ma la configurazione resta da fare a mano: non esiste uno strumento MCP
   per farlo.
3. **Archi di variante / ristampa espliciti** (`ALTERNATE_PRINTING`, `REPRINT_OF`,
   `SAME_VARIANT`) dall'adapter Pokémon, così "Variant" e "Related print" diventano connessioni di
   primo livello, non solo "Also printed in".
4. **Risoluzione manuale degli asset ambigui** nel pannello (scegliere il candidato giusto).
5. **Effetti dedicati ai nodi posseduti** (alone, archi più intensi tra nodi posseduti) e
   statistiche "nodi connessi / costellazioni". Il filtro universale `ownership` ("solo le mie")
   è dichiarato in `packages/filters` ma nascosto nel pannello e non applicato dalle API del grafo.
6. **Slug leggibili per le carte** (`/card/pokemon/charizard-base-set-4`) accanto agli id attuali.
7. **Secondo TCG** (MTG o One Piece) per dimostrare il core agnostico; **adapter Phygitals** se
   le loro API lo consentono.

## Decisione presa: statistiche di carta mai come nodi

Attacchi, abilità, HP e costi restano negli `attributes` della stampa (visibili nella vista
Details) e non diventano entità, archi o filtri. L'adapter Pokémon non emette più nodi `mechanic`
né archi `HAS_ABILITY`; eventuali collegamenti residui di ingestioni precedenti vengono ignorati dal
graph builder. Il tipo di nodo `mechanic` resta disponibile nel core, agnostico, per altri TCG.
