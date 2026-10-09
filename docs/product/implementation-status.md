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
  - `REPRINT_OF` è emesso dal core per ogni carta con più stampe: ogni ristampa punta alla prima
    stampa (per data di uscita), così l'originale è il fulcro di tutte le sue ristampe fra set
    diversi e "Reprint of" / "Reprints" sono connessioni di primo livello (oltre a "Also printed
    in"). Con la sola fixture Base Set non ce ne sono: servono più set a catalogo.
  - Dichiarati nel core ma non emessi: `ALTERNATE_PRINTING`, `SAME_VARIANT`, `RELATED_TO`,
    `REPRESENTS_ASSET` (le varianti sono colonne della stampa, non stampe distinte).
- **Nebbia di profondità** — ❌ (dettaglio estetico; bloom, vignette, particelle e archi animati
  ci sono).
- **Cosa conta come connessione** — ✅. Di default il vicinato mostra altre carte (stampe,
  ristampe, evoluzioni, la carta stessa), set, serie, gioco e l'artista (la via alle altre carte
  che ha illustrato); specie Pokémon ed energy type restano fuori finché il filtro "Node type" non
  li richiede. Dove compare un elemento (Fire, Water, …) la sua icona animata sta alla sua sinistra
  (`ElementIcon`).
- **Immagine ancorata al disco del nodo** — ✅. Il disco con l'immagine è posizionato e orientato
  ogni frame dalla stessa posizione disegnata della sfera e dalla camera di quel frame, e scalato
  sulla silhouette della sfera: riempie il pallino bordo a bordo e non scivola al suo interno.

### 10–11 · La Constellation personale e l'indipendenza dal wallet

- **Il wallet non cambia il mondo, lo illumina** — ✅. `useOwnershipStore` contiene solo gli id
  dei nodi posseduti; `NodeRenderer` li colora con `theme.ownership` (oro) e li ingrandisce del
  25 %; legenda "yours", righe del pannello e chip della vista List marcati.
- **Effetti suggeriti sui nodi posseduti** — ✅. Colore e dimensione, alone dedicato
  (`OwnershipEffects`, una sola draw call), archi più intensi e nel colore oro tra due nodi
  posseduti, toggle "only yours" nella legenda che fa arretrare tutto il resto. Non fatte le
  particelle orbitanti; l'icona wallet è stata deliberatamente evitata (vedi punto 21).
- **Il grafo esiste senza wallet; la mappa pubblica è completa** — ✅. Tutte le API del grafo
  sono anonime e cacheable; `/api/ownership` è l'unico overlay autenticato.
- **URL per carta del tipo `app.com/card/pokemon/charizard-base-set-4`** — ✅.
  `/card/<gioco>/<nome>-<set>-<numero>` (o l'id della sorgente, `base1-4`) e `/set/<gioco>/<slug>`
  reindirizzano all'explorer portando con sé profondità, vista e filtri; Share copia questa forma.
- **Statistiche "37 owned nodes · 214 connected nodes · 6 constellations"** — ✅. Il pannello
  mostra carte possedute, punti connessi e numero di costellazioni (carte possedute che
  condividono set, Pokémon, artista, carta o linea di ristampa).

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
  colora i nodi; gli `ambiguous` compaiono nel pannello con i candidati plausibili e la persona
  sceglie la stampa giusta (scelta conservata dalle sincronizzazioni successive, annullabile).
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
3. **Archi di variante espliciti** (`ALTERNATE_PRINTING`, `SAME_VARIANT`): richiedono stampe
   distinte per variante nel modello dati; oggi le varianti sono attributi della stampa.
4. **Particelle orbitanti** sui nodi posseduti (dettaglio estetico).
5. **Secondo TCG** (MTG o One Piece) per dimostrare il core agnostico; **adapter Phygitals** se
   le loro API lo consentono.

## Decisione presa: statistiche di carta mai come nodi

Attacchi, abilità, HP e costi restano negli `attributes` della stampa (visibili nella vista
Details) e non diventano entità, archi o filtri. L'adapter Pokémon non emette più nodi `mechanic`
né archi `HAS_ABILITY`; eventuali collegamenti residui di ingestioni precedenti vengono ignorati dal
graph builder. Il tipo di nodo `mechanic` resta disponibile nel core, agnostico, per altri TCG.

## Revisione dell'interfaccia (9 ottobre 2026, seconda passata)

Inventario delle card a schermo e decisioni prese, con il criterio "una card per elemento, niente
rumore":

| Vista | Prima | Dopo |
| ----- | ----- | ---- |
| 3D, in basso | pillola di stato (nome del focus, conteggi di connessioni / punti / linee, pallino "camera in volo") + legenda + controlli | solo legenda + controlli: il focus e i conteggi sono già nel pannello di destra |
| 3D, pannello del focus | tre note impilate nell'universo (invito, avviso "solo Base Set", "passa sopra un gruppo…") | una sola frase; l'istruzione sul passaggio del mouse vive nell'help |
| List, punto in focus | tre card: intestazione (nome, azioni), dettagli (immagine, dati), connessioni | due card: il punto (nome, azioni, immagine, dati, altre stampe) e le sue connessioni |
| List, universo | intestazione + catalogo + avviso "solo Base Set" come card a parte | intestazione con l'avviso nella sottotitolazione + catalogo |
| Link che non porta a nulla (`/card/...` sconosciuto) | si atterrava sull'universo senza spiegazione | un avviso discreto, chiudibile, poi l'universo |
| Telefono con WebGL | cielo 3D con pannelli larghi 21 rem su 360 px | vista List di default sotto i 768 px (il 3D resta un tocco di distanza) |

Rimangono volutamente: la landing (hero, come funziona, cosa è connesso, giochi, principi,
invito) perché è una pagina di presentazione e non di dati; il pannello My Constellation come
unica finestra con due sezioni (carte, wallet).

### Parti ancora da fare

1. Catalogo completo su Supabase e in locale: `pnpm ingest` + `pnpm graph:build` da una macchina
   con rete (TCGdex non è raggiungibile da questo ambiente). Senza, ogni collegamento resta nel
   Base Set e le ristampe non compaiono.
2. Configurazione Auth nel dashboard Supabase (Site URL e `/auth/callback` nella allow list).
3. Le 6 righe `mechanic` residue nel seed hosted (query nel messaggio precedente, o
   `pnpm graph:build` sul progetto).
4. Archi di variante (`ALTERNATE_PRINTING`, `SAME_VARIANT`): servono stampe distinte per
   variante nel modello.
5. Particelle orbitanti sui nodi posseduti (estetica).
6. Secondo TCG; adapter per piattaforme proprietarie (Phygitals) se le API lo permettono.
7. Accessibilità del cielo: la scena 3D non è navigabile da tastiera (la vista List lo è);
   un "focus da tastiera" sui punti del vicinato sarebbe la prossima cosa giusta.

## Funzionalità proponibili, costruite su quello che c'è e che altrove non esistono

Il criterio: non replicare binder, scanner, deck builder, prezzi, completamento in percentuale,
marketplace. Ognuna usa pezzi già presenti (grafo tipizzato, `REPRINT_OF`, date di uscita,
statistiche di costellazione, resolver, overlay).

1. **Follow the thread — il percorso fra due carte.** Cerchi due carte e il cielo mostra il
   cammino più breve che le collega (carta → artista → carta → set …), volando tappa per tappa
   con una riga di spiegazione a ogni passo. Grafo-nativo; nessun database di carte lo offre.
   Serve: BFS sul grafo (query SQL ricorsiva), una modalità "percorso" della camera.
2. **Il cielo nel tempo.** Un cursore sulla data di uscita: l'universo si popola set dopo set,
   le ristampe si accendono quando arrivano, la propria costellazione cresce con `first_seen`.
   Serve: `release_date` già nei nodi, animazione di rivelazione già esistente.
3. **Lenti sul cielo.** La stessa costellazione riorganizzata per forza di relazione: lente
   "artista" (le carte si raggruppano attorno a chi le ha disegnate), lente "evoluzione", lente
   "ristampe". Serve: pesi per tipo di relazione nel layout `d3-force-3d`, già parametrico.
4. **La biografia di una carta.** Dalla prima stampa a oggi, tutte le stampe in fila lungo una
   linea di costellazione con anno, set, artista; le tue stampe in oro. Serve: `REPRINT_OF` +
   `useOtherPrintings`, una pagina `/card/<gioco>/<nome>` a livello di identità.
5. **Carte ponte.** Dato ciò che possiedi, le carte che unirebbero due delle tue costellazioni
   (condividono set / Pokémon / artista con entrambe). Scoperta per struttura, non "ti manca il
   3 %": nessun completamento, nessun prezzo. Serve: le componenti già calcolate in
   `constellationStats`, una query sui vicini comuni.
6. **Echi di un set.** Per un set, dove le sue carte sono state ristampate dopo: archi che
   partono dall'originale verso gli altri set, con gli anni. Serve: `REPRINT_OF` in entrata
   sulle stampe del set.
7. **Universo con la tua luce.** Nella vista universo, serie e set brillano in proporzione alle
   carte tue che contengono: nessun numero, solo luce. Serve: `nodeIds` dell'overlay + set delle
   stampe (già nel grafo).
8. **Modalità ambiente.** Lasciata ferma, la camera scivola da una carta a una connessione e poi
   a un'altra, lentamente, come uno screensaver del cielo; un tocco riprende il controllo. Serve:
   la modalità `follow` della camera e il vicinato precaricato.
9. **Carta stellare da stampare.** La tua costellazione esportata come SVG/PNG (punti, linee,
   nomi, niente quantità né valori) da appendere al muro. Serve: posizioni del layout, i nomi; un
   render SVG lato client.
10. **Cieli condivisi.** Il tuo cielo e quello di un'altra persona sovrapposti: dove si toccano,
    cosa avete in comune, senza scambi né valori. **Richiede una decisione tua**: condividere
    dati di possesso in pubblico è fra le scelte che spettano a te (`CLAUDE.md`).

## Roadmap del master specification: cosa è fatto e cosa manca (9 ottobre 2026)

Verifica dei milestone M0–M8 (cap. 82–91), della sequenza di sviluppo (cap. 119–120), del test di
accettazione della vertical slice (cap. 118) e dei capitoli di produzione, contro il codice.

| Milestone | Stato | Dettaglio |
| --------- | ----- | --------- |
| **M0 Foundation** | ✅ | monorepo, TypeScript, Next.js, schema, tipi di dominio, adapter, test runner, canvas 3D: tutto in piedi. |
| **M1 Pokémon Catalog** | 🟡 | Pipeline completa (TCGdex → raw → normalize → validate → identity → printing → database) con provenienza; serie, set, carte, stampe, immagini, artisti. **Manca l'esecuzione dell'import completo** (Task 014): ovunque c'è solo la fixture Base Set. Lingue: una sola per ingestione (`TCGDEX_LANGUAGE`), non il multilingua. |
| **M1 Tests** | ✅ | conteggi, identità e stampe duplicate, id mancanti, relazioni rotte, set non validi, immagini non valide (fallback) coperti da test di adapter, ingestione, grafo. |
| **M2 Search** | ✅ | carte, set, serie, Pokémon, artisti, fuzzy, focus da URL. La *command palette* è stata rimossa su tua richiesta: fuori dalla roadmap, non mancante. |
| **M3 Real Graph** | ✅ | API del grafo, nodi, archi, layout a forze, semantic camera, focus, relazioni animate, espansione progressiva. In più `REPRINT_OF`. |
| **M4 Advanced Filters** | ✅ | filtri schema-driven, dipendenti (set da serie), per relazione (valori calcolati dal grafo), profondità, tipo di nodo, lingua, variante. (La prima verifica lo segnava parziale per errore: il filtro per relazione è già nel pannello.) |
| **M5 My Constellation** | ✅ | autenticazione, collegamento wallet con firma, scoperta asset, resolver, confidenza, storage, overlay visivo (+ scelta manuale, statistiche, effetti). |
| **M6 Digital Platforms** | 🟡 | Tutto ciò che non richiede una chiave è fatto: EVM su dieci catene Blockscout (Ethereum, Polygon, Base, Arbitrum, Optimism, Gnosis, ZKsync, Scroll, Linea, Immutable zkEVM) e Solana senza chiave tramite RPC pubblico (token account → metadata Metaplex → JSON), con DAS quando configurato. **Non implementati per scelta**: OpenSea e Phygitals (chiavi API). Nota: il percorso RPC pubblico Solana è verificato con dati sintetici, non ancora contro un wallet reale. |
| **M7 Production** | ✅ | RLS verificata con gli advisor, rate limiting, caching, source health e freschezza, `Server-Timing`; **ora anche**: integrazione continua (`.github/workflows/ci.yml`: typecheck, test, build, e2e), intestazioni di sicurezza (CSP, nosniff, frame, referrer, permissions), crash lato client raccolti nel log del server (`/api/client-error`), navigazione da tastiera nel cielo (frecce e Invio, con regione live per gli screen reader), test automatico del budget di layout (500 punti, 1500 linee). Senza servizi esterni: un error monitoring dedicato resta una tua decisione. |
| **M8 Second TCG** | ❌ | One Piece, poi MTG, Yu-Gi-Oh!, Lorcana: non iniziato (fuori da questa fase, Q5). **Attenzione**: TCGdex copre solo il Pokémon TCG; per One Piece servirà un'altra fonte con API stabile, da scegliere quando si apre M8. Firecrawl non serve. |

**Sequenza di sviluppo (cap. 119)**: fasi 0–1 e 3–8 fatte; **fase 2 (ingestione completa)** da eseguire da una
macchina con rete; fase 9 non iniziata; fase 10 parziale come sopra. **Ordine immediato (cap. 120)**:
Task 001–013 fatti, **Task 014 (import completo) no**.

**Test di accettazione della vertical slice (cap. 118)**: tutti i passi passano, con una deviazione
voluta: "Pokémon relationship appears" oggi compare solo con il filtro Node type (su tua richiesta
le connessioni di default sono carte, set e artista).

**Capitoli di produzione**: Firecrawl (70–71) non serve: le fonti sono API stabili. Osservabilità
(102): ingestione, confidenza del resolver, asset non risolti, errori dei provider e ora anche i
crash lato client finiscono nel log; latenze come `Server-Timing`. Licensing (105): attribuzioni
esposte ovunque (vedi sotto); la verifica formale dei termini resta un ticket di ricerca (Q10).

**Attribuzioni e licenze** (richiesta del 9 ottobre): ogni adapter dichiara `attribution` (fonte e
termini, titolari dei diritti, disclaimer) e senza non compila; `GET /api/games` la espone; il
footer di ogni pagina, `/help#credits` e il cielo (pillola "Data: TCGdex · © Pokémon") la mostrano.
`docs/legal/ATTRIBUTION.md` raccoglie tutto; `docs/legal/THIRD_PARTY_NOTICES.md` elenca le
dipendenze open source per licenza (`pnpm licenses:notices` lo rigenera); il codice è MIT.

**M1, lingue**: la pipeline ora mantiene l'identità di una carta anche quando la fonte la consegna
con un altro nome (un'altra lingua, una rinomina); l'ingestione in più lingue resta una decisione
(quale lingua è canonica per i nomi di set e serie, come mostrare i nomi localizzati).

**Future Features (cap. 111)**: public exploration links ✅ (`/card/...`, `/set/...`, link
dell'explorer); artist universes, Pokémon evolution maps, card lineage 🟡 (le relazioni ci sono,
manca una vista dedicata); shared constellations, saved views, constellation snapshots, community
annotations, semantic collections, set timelines, cross-TCG ❌.

### Vittorie rapide emerse dalla verifica

1. Workflow di integrazione continua (typecheck, test, build, e2e con il Chromium di Playwright).
2. Filtro per tipo di relazione: basta dare valori al filtro `relationship` (tipi universali +
   quelli dell'adapter) perché il pannello lo mostri e l'API già lo applichi.
3. Intestazioni di sicurezza in `next.config` (CSP con le sole origini usate: TCGdex, Supabase).
4. Tastiera nel cielo: frecce per passare da una connessione all'altra, Invio per volare.

### Correzione emersa dai test end-to-end (9 ottobre)

Il vicinato tagliava a 60 connessioni **per nodo** in ordine arbitrario: per un set con 102 carte
sparivano la serie e carte come Charizard (#4). Ora il budget è **per nodo e per tipo di
relazione**, in ordine deterministico e leggibile (peso, poi numero di collezione con le cifre per
lunghezza, poi nome): un set mostra sempre la sua serie e le sue prime carte, una carta mostra ogni
tipo di connessione che ha. Test di regressione in `packages/graph`.

## Fase 2: la mappa (9 ottobre 2026)

Le decisioni del grilling (due round, in `.scratch/fase-2/grilling.md`) fissano la destinazione:
**il cielo come unico grafo continuo e navigabile**: ogni spostamento lascia un filo visibile nella
sessione, e fra due punti qualsiasi si vede il cammino che li unisce, condivisibile come
`/thread/<a>/<b>`. Carte ponte, cieli condivisi e cielo nel tempo restano definiti nel glossario ma
fuori da questa fase. La mappa dei ticket di decisione è in `.scratch/fase-2/map.md`
(convenzione `wayfinder`, tracker markdown locale): due task del proprietario (import completo,
configurazione Auth), due ricerche (algoritmo del cammino, termini TCGdex e marchi), due grilling
(come si vede il filo, come si chiede e si mostra il cammino), due prototipi e l'accettazione.

**Ricerche concluse (9 ottobre)**, note in `.scratch/fase-2/research/`:

- *Cammino fra due punti* (ticket 03): BFS bidirezionale **in memoria** su un indice di adiacenza
  per gioco, caricato alla prima richiesta e tenuto in cache come le altre (misurato sul fixture:
  7 ms di caricamento, 1,4 ms per cammino; stima a catalogo completo ~130k archi, 6–10 MB, 1–10 ms
  per cammino, 0,8–2 s il primo caricamento). Le CTE ricorsive che portano l'array del cammino
  esplodono (1–2 s a profondità 6 già sul fixture) e non vanno usate. Profondità 6 di default, 8 come
  tetto; ponti di default = carte, set, serie, artista, ristampe ed evoluzioni, **senza il nodo
  gioco come transito** (altrimenti ogni cammino collassa in carta → set → serie → gioco → …) e
  senza tipi di energia (renderebbero ogni coppia distante 2). Spareggio deterministico (preferenza
  per relazione, poi id) perché l'URL `/thread/<a>/<b>` sia condivisibile.
- *Termini TCGdex e marchi* (ticket 04): i dati TCGdex sono **MIT** (© 2021 TCGdex, unica
  condizione conservare l'avviso); le **immagini non sono coperte** dalla licenza e restano di The
  Pokémon Company (TCGdex le serve, non le licenzia); API libera senza chiave, nessun limite
  pubblicato, caching incoraggiato. Attribuzioni aggiornate di conseguenza (adapter, footer, help,
  README, `docs/legal/ATTRIBUTION.md`): licenza nominata con l'avviso, immagini dichiarate linkate e
  mai archiviate, riga ufficiale dei titolari, disclaimer nella forma "not produced, endorsed,
  supported or affiliated". Nessun disclaimer concede diritti: prima di un annuncio pubblico serve
  la conferma di un legale e conviene avvisare TCGdex del progetto.
