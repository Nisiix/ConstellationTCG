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

## Not yet specified

- **Universo continuo**: nella vista universo i set come gruppi uniti da ponti (ristampe, stesso
  Pokémon, stesso artista) invece di una lista. Conseguenza della destinazione, dopo filo e cammino.
- **Tastiera lungo il filo**: tornare indietro e avanti sul filo con i tasti; dipende da come il
  filo verrà disegnato.
- **Cammini sul catalogo completo**: profondità massima, tempi e limiti dipendono dall'import
  (ticket 01) e dalla ricerca sull'algoritmo (ticket 03).
- **Lingue**: ingestione in più lingue (quale lingua è canonica per set e serie, come mostrare i
  nomi stampati); l'identità già regge.

## Out of scope

- **Carte ponte** e **cieli condivisi**: definizioni accettate e nel glossario, ma non sono la
  destinazione di questa fase (risposta Q12: un grafo navigabile, non funzionalità a sé).
- **Il cielo nel tempo** (cursore sulla data di uscita).
- **Secondo TCG** (TCGdex copre solo Pokémon: servirà un'altra fonte), **OpenSea** e **Phygitals**
  (chiavi API), **Firecrawl**.
