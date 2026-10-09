# Come si calcola il cammino fra due punti, e a che costo

Risposta alla issue 03. Basi: `packages/graph/src/neighborhood.ts` e `builder.ts`, lo schema
`supabase/migrations/20261008000001_init.sql`, `apps/web/src/lib/connections.ts`,
`apps/web/src/server/cache.ts`, e un banco di prova (script non versionato) su PGlite con il fixture
Base Set.

## Dimensioni attese

Fixture misurato: 102 stampe → 289 nodi, 597 archi, cioè 5,85 archi per stampa (PRINTING_OF,
BELONGS_TO, ILLUSTRATED_BY = 1 ciascuno; SAME_POKEMON e HAS_TYPE 0,68; WEAK_TO 0,63;
EVOLVES_FROM/EVOLUTION_OF 0,29; RESISTS 0,2; HAS_ATTRIBUTE 0,07). A catalogo completo (20k stampe) le
carte moderne aggiungono HAS_ATTRIBUTE (tipo di Trainer) e REPRINT_OF (una per ristampa): stima
6–7 archi/stampa ⇒ **~130k archi** (300k è il tetto, solo con più lingue) e **~30–40k nodi** (le
identità dipendono da quante ristampe collassano: nel fixture sono 1:1). Il sottografo dei soli
"ponti" (§3) è più piccolo: ~4 archi/stampa ⇒ **~80k archi**.

## 1. Opzioni

| | Approccio | Pro | Contro |
|---|---|---|---|
| a | BFS bidirezionale in SQL: due CTE ricorsive che si incontrano | una query, nessuno stato | Con l'array del cammino la CTE enumera cammini, non nodi, ed esplode (misure in §4). La variante "solo distanze" con `UNION` è limitata a ≤ N nodi per livello, ma il cammino va ricostruito con query aggiuntive |
| b | CTE singola dalla sorgente con tetto di profondità | semplice | Esponenziale: nel fixture (597 archi) 24 ms a prof. 4 (8.138 righe per 154 nodi distinti), 140 ms a 5, **0,9–1,8 s a 6**. A catalogo un set (300 stampe) o un artista (1.000+) al secondo salto rende impraticabile prof. > 3 |
| c | BFS bidirezionale in memoria su indice di adiacenza per gioco | 1–10 ms a caldo, l'insieme dei visitati elimina l'esplosione, banale da testare | caricamento a freddo (§4); invalidazione quando `graph:build` riscrive la proiezione |
| d | Landmark / hub labeling precalcolati | O(1) per query | precalcolo nel worker e tabella in più; inutile per 40k nodi |
| e | BFS a salti dall'app, una query per salto (il pattern di `neighborhood.ts`) | senza stato né memoria | 6 round-trip Vercel↔Supabase, liste `IN` da migliaia di id al terzo salto: 150–400 ms |

**Raccomandazione v1: (c)**, indice CSR per gioco caricato pigramente alla prima richiesta e tenuto in
`globalThis` come le `TtlCache` esistenti; (e) resta il ripiego senza stato se il freddo su Vercel si
rivelasse un problema. **Evoluzione**, non (d): una tabella `graph_builds(game_id, built_at, nodes,
edges)` scritta dal builder per invalidare l'indice in modo esatto; cammini "interessanti" (penalità
sugli hub, cammini alternativi) sullo stesso indice; se il grafo decuplica, processo lungo o (a)
solo-distanze.

## 2. Profondità massima

**6 salti** di default, **8** come tetto assoluto. Senza il nodo `game` come transito (§3),
stampa → artista → stampa → set → stampa → artista → stampa copre praticamente ogni coppia, perché i
~400 artisti e i ~170 set attraversano le ere; identità↔identità o artista↔artista costano al massimo
due salti in più. Oltre 8 punti una striscia passo per passo non si legge più. Estremi di giochi diversi:
non esistono archi fra proiezioni, rispondere subito "nessun cammino" senza cercare. Nessun cammino entro
il tetto: HTTP 200 con `{ found: false, maxDepth, visitedFrom, visitedTo }` e, in UI, l'offerta di
allargare i ponti (specie, tipi) o di ammettere il gioco: con `game` un cammino nello stesso gioco esiste
sempre entro 8.

## 3. Ponti di default

Nodi di transito = `CONNECTION_NODE_TYPES` (`series, set, card_identity, card_printing, artist`) **meno
`game`**, ammesso solo come estremo: altrimenti ogni cammino collassa in "X → set → serie → Pokémon TCG
→ serie → set → Y", corretto ma vuoto. Archi ammessi di conseguenza: `BELONGS_TO, PART_OF, PRINTING_OF,
ILLUSTRATED_BY, REPRINT_OF, EVOLVES_FROM, EVOLUTION_OF`, percorsi in entrambi i versi come fa il vicinato.
Esclusi `HAS_TYPE, WEAK_TO, RESISTS, HAS_ATTRIBUTE, SAME_POKEMON` (nodi `attribute`/`pokemon`): "Fuoco"
collega migliaia di carte e rende ogni coppia distante 2; il filtro "Tipo di nodo" li riattiva, come nel
vicinato. A pari lunghezza, ordine di preferenza per relazione definito dal modulo cammino (non i
`weight`, che servono al layout e favorirebbero il catalogo): ristampa, evoluzione, artista, identità,
poi set, poi serie; ultimo spareggio sull'id del nodo, così il cammino è deterministico e l'URL
condivisibile.

## 4. Costi

| | Stima |
|---|---|
| (a)/(b) con array del cammino, PostgreSQL | fixture su PGlite: 3–24 ms a prof. ≤ 4, 1,8 s a 6. A catalogo: set da 300 e artista da 1.000 al secondo salto ⇒ 10⁵–10⁶ righe a prof. 3 per lato ⇒ 0,5–5 s, rischio `statement_timeout`. Gli indici `graph_edges_source_idx`/`_target_idx` bastano (BitmapOr sull'`or`) |
| (a) solo-distanze (`UNION`, righe `(node, depth)`) | ≤ ~40k righe per livello ⇒ 50–300 ms, più 2–6 query di ricostruzione a 5–20 ms di round-trip ciascuna |
| (c) caricamento | `select source_node_id, target_node_id, relationship_type from graph_edges` ~130k righe ≈ 15–25 MB sul filo: 0,8–2 s da Supabase, 2–4 s in PGlite; fixture 7 ms |
| (c) memoria | CSR (`Int32Array` offset e vicini, `Uint8Array` tipi, stringhe id) ≈ 6–10 MB; `Map<string, [id, tipo][]>` ingenua 30–50 MB. Vercel dà 1–2 GB |
| (c) query | fixture 1,4 ms; a catalogo ≤ 20k nodi visitati (3+3) ⇒ 1–10 ms, da mettere in `TtlCache` con chiave (da, a, opzioni) |
| PGlite nei test | fixture costruito in ~100 ms; in memoria tutto istantaneo. Evitare test che dipendano da CTE a prof. > 4 (secondi) |

Invalidazione v1, finché non esiste `graph_builds`: tutti i nodi di una build condividono lo stesso
`created_at`, e `graph_nodes_game_type_idx` rende la domanda economica:

```sql
select max(created_at) from graph_nodes where game_id = $1;
```

Da confrontare con il timbro dell'indice a ogni richiesta (o ogni 120 s come le altre cache).

## 5. Rischi e misure del prototipo

1. **Esplosione degli hub**: su 100 coppie casuali del catalogo completo (dipende dalla issue 01),
   dimensione della frontiera per salto e tempo BFS; se il terzo salto supera ~20k nodi, raggio 2+3 o
   penalità sugli hub.
2. **Freddo su Vercel**: tempo di caricamento e heap dopo la costruzione dell'indice; decidere pigro
   (serverless) o in `warmUp()` (Node lungo).
3. **Indice stantio dopo `graph:build`**: test di regressione con rebuild fra due richieste; un cammino
   con nodi che poi rispondono 404 è il sintomo.
4. **Qualità**: quota di cammini che passano solo da set/serie contro artista/identità/evoluzione, per
   calibrare le preferenze e decidere se la serie resta ponte.
5. **Determinismo** fra cammini di pari lunghezza (URL condivisibili).
6. **Tempo massimo**: `statement_timeout` di 2 s per la variante SQL; per la (c) un budget di nodi
   visitati, non di tempo.
