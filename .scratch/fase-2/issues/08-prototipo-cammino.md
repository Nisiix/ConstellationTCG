# Prototipo del cammino `/thread/<a>/<b>`

Type: prototype
Status: claimed
Blocked by: 06 (03 risolto: BFS bidirezionale in memoria, misure da fare elencate nella sua
`## Answer`)

## Question

Un prototipo del cammino fra due punti su dati Base Set: richiesta, calcolo, visualizzazione tappa
per tappa con la riga di spiegazione, indirizzo condivisibile. Da guardare insieme prima della
specifica.

## Answer

Prototipo su `main` (9 ottobre 2026, sera). Resta aperto solo per le **misure sul catalogo completo**
(dipendono dal ticket 01).

- **Calcolo**: `packages/graph/src/path.ts`: indice CSR per gioco (array tipizzati, id ordinati così
  lo spareggio sull'id è gratuito), caricato alla prima richiesta in `globalThis` e ricostruito quando
  cambia il timbro della proiezione (numero e data dei nodi del gioco, numero di archi; controllato
  al massimo ogni 60 s). BFS dalla destinazione fino al livello che raggiunge la partenza, poi
  cammino greedy dalla partenza con la preferenza ristampa → evoluzione → artista → carta → set →
  serie → id: deterministico. Ponti fissi; un estremo di qualunque tipo esce da qualunque sua
  connessione (gioco, specie, tipi di energia solo come estremi). Budget di 200k nodi visitati.
  Se fra lettura dell'indice e lettura dei nodi la proiezione cambia, si ricostruisce e si riprova.
- **API**: `GET /api/graph/path?from&to[&max]` (cache 120 s come le altre); `/thread/<a>/<b>[?view=list]`
  reindirizza a `/explore?node=<a>&path=<a>,<b>`.
- **Interfaccia**: "Connect to…" nel pannello del punto (3D e List) apre una ricerca; il punto scelto
  apre il cammino. In 3D il cielo mostra solo il cammino attorno alla tappa in mano, il pannello a
  destra lo elenca numerato con un'etichetta compatta per arco ("Charizard — illustrated by →
  Mitsuhiro Arita"), ← → o un clic (nel pannello o sui punti) lo percorrono, ogni tappa entra nel
  filo; "Explore from here" esce dal cammino. In List la stessa cosa come pagina. Nessun cammino:
  "No path within 6 steps" e "Search further (8 steps)"; giochi diversi: detto subito.
- **Misure sul fixture** (102 stampe, 289 nodi, 597 archi): ~18 ms a freddo compreso il caricamento
  dell'indice, Charizard → Mitsuhiro Arita → Pikachu con 107 nodi visitati.
- **Test**: unitari su grafo sintetico e fixture (`packages/graph/src/__tests__/path.test.ts`:
  preferenze, niente transito da gioco/energia/specie, profondità, determinismo, indice stantio dopo
  una modifica della proiezione), `lib/__tests__/path-steps.test.ts`, e2e in `e2e/thread.spec.ts`
  (API, redirect, Connect to → percorso → esplora da qui, nessun cammino → cerca più lontano).
- **Da misurare a catalogo completo** (dopo 01): frontiera per salto e tempo su 100 coppie casuali,
  freddo su Vercel (caricamento e heap dell'indice), quota di cammini solo set/serie.
