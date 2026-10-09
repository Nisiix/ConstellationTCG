# Come si calcola il cammino fra due punti, e a che costo

Type: research
Status: resolved
Blocked by: —

## Question

Per il cammino fra due punti qualsiasi del grafo (`graph_edges`, ~20k stampe e centinaia di
migliaia di archi a catalogo completo): quale algoritmo (BFS bidirezionale in SQL ricorsiva su
PostgreSQL/PGlite, oppure BFS in memoria su un indice di adiacenza caricato una volta per gioco),
con quale profondità massima ragionevole (6? 8?), quali tipi di relazione come ponte di default
(carte, set, serie, artista come nel vicinato) e quale costo in tempo e memoria sul server (Vercel
serverless) e su PGlite. Serve una raccomandazione motivata e una stima, non codice.

## Answer

Nota completa: [`../research/03-algoritmo-cammino.md`](../research/03-algoritmo-cammino.md)
(9 ottobre 2026, con banco di prova su PGlite e fixture Base Set).

- **Algoritmo v1: BFS bidirezionale in memoria** su un indice di adiacenza (CSR) per gioco,
  caricato pigramente alla prima richiesta e tenuto in `globalThis` come le `TtlCache` esistenti.
  Misurato sul fixture: 7 ms di caricamento, 1,4 ms per cammino. Stima a catalogo completo:
  ~130k archi e 30–40k nodi, 6–10 MB di heap, 0,8–2 s il primo caricamento da Supabase, 1–10 ms
  per cammino. Ripiego senza stato: BFS a salti dall'app (una query per salto, 150–400 ms).
- **Da non usare**: CTE ricorsive che portano l'array del cammino, esponenziali (sul fixture 24 ms a
  profondità 4, 1–2 s a 6; a catalogo 0,5–5 s con rischio `statement_timeout`). Nei test evitare CTE
  oltre profondità 4.
- **Profondità**: 6 di default, 8 come tetto. Estremi di giochi diversi ⇒ "nessun cammino" subito.
  Nessun cammino entro il tetto ⇒ HTTP 200 con `found: false` e i nodi visitati, offrendo di
  allargare i ponti.
- **Ponti di default**: i tipi delle connessioni (`series, set, card_identity, card_printing,
  artist`) **meno `game`**, ammesso solo come estremo, altrimenti ogni cammino collassa in
  carta → set → serie → gioco → serie → set → carta. Archi: `BELONGS_TO, PART_OF, PRINTING_OF,
  ILLUSTRATED_BY, REPRINT_OF, EVOLVES_FROM, EVOLUTION_OF`. Esclusi per default i tipi di energia e
  gli attributi (ogni coppia diventerebbe distante 2); il filtro "Tipo di nodo" li riattiva.
- **Determinismo**: a pari lunghezza, ordine di preferenza per relazione (ristampa, evoluzione,
  artista, identità, set, serie) e poi id del nodo, così `/thread/<a>/<b>` è condivisibile.
- **Invalidazione**: `max(created_at)` dei nodi del gioco finché non esiste una tabella
  `graph_builds`; evoluzione: penalità sugli hub e cammini alternativi sullo stesso indice.
- **Il prototipo (08) deve misurare**: frontiera per salto e tempo su 100 coppie casuali del catalogo
  completo (dipende da 01), freddo su Vercel, indice stantio dopo `graph:build` (test di
  regressione), quota di cammini che passano solo da set/serie, determinismo, budget di nodi visitati.
