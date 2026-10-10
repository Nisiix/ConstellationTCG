# Mappa · Fase 2 — il cielo come grafo continuo e navigabile

Tracker locale (convenzione `wayfinder`): un file per ticket in `issues/NN-<slug>.md`, con `Type:`
(research / prototype / grilling / task) e `Status:` (open / claimed / resolved) e `Blocked by:`.
La **frontiera** sono i ticket aperti, non bloccati e non reclamati; si risolve un ticket per
sessione (le ricerche fanno eccezione). Risposte del grilling che hanno fissato la destinazione:
[grilling.md](./grilling.md).

## Destination

Il cielo è **un unico grafo continuo e navigabile**: ogni spostamento da un punto all'altro lascia
un **filo** visibile per tutta la sessione (il cielo non si azzera mai), e fra **due punti
qualsiasi** si può chiedere e vedere il **cammino** che li unisce, tappa per tappa, con una riga che
spiega ogni arco; il cammino è condivisibile (`/thread/<a>/<b>`) e viene ricalcolato all'apertura.
Fatto = per filo e cammino esistono un test end-to-end del viaggio completo, una frase nel documento
di stato e la voce nell'help.

## Notes

- Dominio: Constellation TCG, solo Pokémon in questa fase. Regole dure in `CLAUDE.md`
  (niente prezzi, niente portfolio, relazioni non statistiche, core agnostico). Parole in
  `GLOSSARY.md` (filo, cammino, carta ponte, cielo condiviso già fissati).
- Skill da consultare in ogni sessione: `grilling` + `domain-modeling` (repo pubblico di Matt
  Pocock, `skills/productivity/grilling`, `skills/engineering/domain-modeling`).
- Preferenze: lavoro solo su `main`, nessun altro branch (le ricerche scrivono in
  `.scratch/fase-2/research/`, non su branch `research/*`); push alla fine di ogni sessione;
  un solo decisore (il proprietario del repo); hosting Vercel + Supabase; nessun servizio a
  pagamento nuovo senza approvazione; progetto pubblico non commerciale.
- Persona primaria: il collezionista-esploratore; porta d'ingresso: il curioso che cerca una carta.
  Segnale di successo: una persona condivide un link (a una carta, a un cammino).

## Decisions so far

- [Grilling round 1 e 2](./grilling.md): destinazione (a)+(b); un solo gioco; dati di possesso in
  pubblico solo opt-in, sola lettura, senza quantità né indirizzi, con revoca; parole fissate nel
  glossario; tracker markdown locale; orizzonte due mesi; progetto pubblico non commerciale; il
  filo vive nella sessione e si condivide come cammino fra due estremi ricalcolato; "fatto" = e2e +
  stato + help; import del catalogo e configurazione Auth a carico del proprietario.
- [Ricerca 03, algoritmo del cammino](./issues/03-algoritmo-cammino.md) (nota in
  [research/](./research/03-algoritmo-cammino.md)): BFS bidirezionale in memoria su indice per
  gioco, non CTE ricorsive; profondità 6 (tetto 8); ponti = carte, set, serie, artista, ristampe,
  evoluzioni, senza il nodo gioco come transito; spareggio deterministico per URL condivisibili.
  Sblocca 06; il prototipo 08 deve misurare sul catalogo completo.
- [Ricerca 04, termini TCGdex e marchi](./issues/04-termini-tcgdex-e-marchi.md) (nota in
  [research/](./research/04-termini-tcgdex-e-marchi.md)): dati MIT con avviso da conservare,
  immagini senza licenza e solo linkate; attribuzioni aggiornate (adapter, footer, help, README,
  `docs/legal/ATTRIBUTION.md`). Prima dell'annuncio: conferma legale e avviso a TCGdex.
- [Grilling 05, come si vede il filo](./issues/05-come-si-vede-il-filo.md): scia di particelle;
  ultime 12 tappe accese, le vecchie sfumano; il vicinato precedente scompare; ritorno dal pannello
  "Il tuo filo" (Backspace invariato); filtri e profondità non toccano il filo; in List la stessa
  sezione.
- [Grilling 09, accettazione](./issues/09-accettazione-filo-e-cammino.md): e2e del viaggio con una
  fixture a due set nel repo (Base Set + Base Set 2); p95 ≤ 300 ms a caldo, ≤ 3 s a freddo; 6 tappe,
  8 su richiesta; "fatto" = e2e + stato + help + misure sul catalogo completo dentro i limiti.
- [Grilling 06, come si chiede e si mostra il cammino](./issues/06-come-si-chiede-e-si-mostra-il-cammino.md):
  "Connect to…" nel pannello; il cammino appare intero e poi si percorre; etichette compatte;
  ponti fissi; "Search further" fino a 8; `/thread/<a>/<b>` con i soli estremi e la vista; in List
  elenco numerato; il cammino percorso entra nel filo.

## Frontier (prossima sessione)

La mappa è finita: tutti i ticket di decisione sono chiusi e la via alla destinazione è fissata
dal ticket 09. Restano solo lavori del proprietario e una misura:

- **Fixture Base Set 2** (09): `pnpm --filter @constellation/adapter-pokemon fixture:refresh base4`
  da una macchina con rete, poi commit (in TCGdex Base Set 2 è `base4`; la fixture `base2` già
  committata è Jungle); i due test e2e fra set diversi smettono di essere saltati.
- **01** import completo: riparte da solo quando cade la restrizione dell'organizzazione Supabase.
- **08** (resta `claimed`): `pnpm path:measure` sul catalogo completo, dentro i limiti del 09;
  con quello filo e cammino sono "fatti".
- **02** configurazione Auth: dalla dashboard Supabase.

## Not yet specified

- ~~**Universo continuo**~~ (10 ottobre, valore di partenza rivedibile): l'universo include i ponti
  più forti fra set (stessi Pokémon, stessi artisti, struttura simile; al massimo 3 per set, i più
  forti), così nel cielo i set affini si raggruppano anche fra serie diverse. La vista List resta
  l'elenco per serie.
- ~~**Tastiera lungo il filo**~~ (10 ottobre, valore di partenza rivedibile): `[` indietro e `]`
  avanti lungo il filo, senza aggiungere passi; un nuovo focus dopo la camminata torna ad
  allungarlo. Il pannello "Your thread" segna il passo in vista.
- **Cammini sul catalogo completo**: l'algoritmo è scelto (ticket 03); le misure reali (frontiera
  per salto, freddo su Vercel, indice stantio dopo `graph:build`) aspettano l'import (ticket 01) e
  si fanno nel prototipo 08.
- **Lingue**: ingestione in più lingue (quale lingua è canonica per set e serie, come mostrare i
  nomi stampati); l'identità già regge.

## Out of scope

- **Carte ponte** e **cieli condivisi**: definizioni accettate e nel glossario, ma non sono la
  destinazione di questa fase (risposta Q12: un grafo navigabile, non funzionalità a sé).
- **Il cielo nel tempo** (cursore sulla data di uscita).
- **Secondo TCG** (TCGdex copre solo Pokémon: servirà un'altra fonte), **OpenSea** e **Phygitals**
  (chiavi API), **Firecrawl**.
