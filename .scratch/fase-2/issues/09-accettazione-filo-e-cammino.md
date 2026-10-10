# Accettazione: cosa deve passare perché filo e cammino siano "fatti"

Type: grilling
Status: resolved
Blocked by: —

## Question

Dai prototipi alla specifica: i test end-to-end del viaggio completo (filo: tre spostamenti e
ritorno; cammino: due carte di set diversi sul catalogo completo, e un caso senza cammino), la frase
nel documento di stato, la voce nell'help, i limiti di prestazione accettati (tempo massimo del
cammino, numero massimo di tappe). Chiusa questa, la via alla destinazione è chiara e la mappa
finisce.

## Answer

Grilling del 9 ottobre 2026 (sera), risposte del proprietario. **Filo e cammino sono "fatti"
quando passano tutti questi criteri:**

1. **Test end-to-end del viaggio** (`apps/web/e2e/thread.spec.ts`), verdi in CI:
   - filo: tre spostamenti, ritorno dal pannello, profondità che non lo tocca, ricarica della scheda
     (già verde);
   - cammino: API, `/thread/<a>/<b>`, Connect to → percorso → esplora da qui, nessun cammino entro la
     profondità → "Search further" (già verdi);
   - **due carte di set diversi** e **una ristampa in un passo**: girano su una **fixture a due set
     nel repository** (Base Set + Base Set 2, dati TCGdex veri), così la CI resta offline. Il server
     e2e carica `base4` se è presente; finché non c'è, i due test vengono saltati con il comando da
     eseguire. La fixture va generata da una macchina con rete (gli agenti non raggiungono TCGdex):
     `pnpm --filter @constellation/adapter-pokemon fixture:refresh base4`, poi commit.
     Attenzione: in TCGdex Base Set 2 è **`base4`**; `base2` è Jungle (la fixture `base2` già nel
     repository è Jungle: utile per gli artisti fra set, ma non ha ristampe del Base Set).
2. **Frase nel documento di stato** e **voce nell'help**: presenti (`docs/product/implementation-status.md`,
   `apps/web/src/lib/help-content.ts`).
3. **Limiti di prestazione** (lato server):
   - cammino con l'indice caricato: **p95 ≤ 300 ms**; primo caricamento dell'indice: **≤ 3 s**;
   - tappe: **6 di default, fino a 8 su richiesta** ("Search further"), come nel prototipo.
4. **Misure sul catalogo completo dentro questi limiti**: `pnpm path:measure` (100 coppie di stampe
   di set diversi, seme fisso; esce con errore se un limite è superato) contro il database di
   produzione, dopo l'import del ticket 01. Il risultato chiude anche il ticket 08.

Non richiesti per "fatto" (scelta del proprietario): la revisione visiva nel 3D e la tastiera lungo
il filo (restano in "Not yet specified").

Già in CI, a guardia dell'algoritmo: `packages/graph/src/__tests__/path-budget.test.ts` costruisce
un grafo sintetico della taglia del catalogo (~20k stampe, ~130k archi) e verifica caricamento
dell'indice < 3 s e p95 < 300 ms su 100 coppie (oggi: tutto in meno di 0,3 s). Sul fixture Base Set
`pnpm path:measure` dà 55 ms a freddo e p95 11 ms (non è la misura vera: un solo set).
