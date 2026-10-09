# Import completo del catalogo Pokémon su Supabase

Type: task
Status: claimed
Blocked by: —
Owner: il progetto Supabase stesso (Edge Function `catalog-import` + pg_cron); nessuna password in mano a nessuno

## Question

Portare il catalogo Pokémon completo (tutte le serie, i set, le carte) nel database di produzione
e ricostruire il grafo, così che filo e cammino si vedano su dati reali e non sul solo Base Set.

## Come è stato risolto (9 ottobre 2026)

Il proprietario ha scelto l'import **lato server** invece del comando dal PC. L'ambiente degli
agenti non raggiunge TCGdex e il connettore non espone la password del database: la soluzione
gira dentro Supabase, dove entrambe le cose sono disponibili.

- `packages/catalog-import`: l'import come **coda di job piccoli e ripristinabili**
  (`catalog_import_jobs`): un job `plan` elenca i set alla fonte e mette in coda un job `set` per
  ogni set cambiato (o tutti, con `full`), poi job `graph` che ricostruiscono la proiezione a
  passi limitati (scaffold, pagine di identità, un passo per set, pagine di ristampe, finish).
  Ogni passo sta nei limiti di una Edge Function (2 s di CPU, 150 s di durata); un job fallito
  torna in coda fino a 3 tentativi; un job il cui worker tace viene ripreso dopo 10 minuti.
- `packages/graph`: `compose.ts` (composizione pura, condivisa) e `incremental.ts` (`runGraphStep`),
  con il test che dimostra l'uguaglianza esatta con il builder in un colpo solo; colonna
  `build_id` su nodi e archi per cancellare alla fine ciò che il catalogo non ha più.
- `supabase/functions/catalog-import`: Edge Function Deno che esegue un job per chiamata, connessa
  con `SUPABASE_DB_URL` (variabile della piattaforma) e autenticata con un token **generato nel
  database** (Vault) e riletto dalla funzione. Bundle in `bundle.js` (`pnpm functions:build`), entry
  `index.ts` che lo importa dal repository GitHub; CI verifica che il bundle sia aggiornato.
- Migrazione `20261010000001_catalog_import.sql`: tabella, `catalog_import_request/status/
  retry_failed` (portabili, anche su PGlite), `catalog_import_tick/schedule/unschedule` (solo
  hosted: pg_net + pg_cron + Vault). Sul progetto: tick ogni 20 s finché c'è lavoro, refresh
  incrementale ogni domenica alle 03:15 UTC.
- CLI equivalente: `pnpm catalog:import` (con `DATABASE_URL`).

## Checklist

1. ✅ Migrazione applicata e registrata su Supabase; `pg_net` e `pg_cron` attivati; token e URL in
   Vault; cron `catalog-import-tick` (20 s) e `catalog-import-refresh` (domenica 03:15) schedulati.
2. Deploy della funzione (`deploy_edge_function`, `verify_jwt: false`) dopo il push del bundle.
3. `select catalog_import_request('pokemon', true)` e seguire `select catalog_import_status('pokemon')`.
4. Verificare: `select count(*) from card_printings` nell'ordine delle decine di migliaia; `/explore`
   deve elencare tutte le serie; `ingestion_errors` da leggere.
5. Scrivere qui sotto, in `## Answer`, conteggi e data.

## Stato (9 ottobre 2026, 16:20 UTC)

- ✅ Funzione distribuita: `catalog-import` versione 1, entry pinnato al commit `1b36d7c`,
  `verify_jwt` off (token in Vault). Cron attivo, run completo richiesto (plan
  `1453539c-6f79-41e3-acc7-03dec9a88782`), job `plan` in coda.
- ⛔ **Bloccato da Supabase, non dal codice**: ogni chiamata alla funzione riceve `402 Service for
  this project is restricted due to the following violations: exceed_db_size_quota`. Il database di
  ConstellationTCG è di 14 MB: la quota superata è dell'**organizzazione** "Nisiix" (piano free),
  che contiene anche il progetto "SwapWish TCG"; Supabase limita tutti i progetti dell'organizzazione
  finché l'uso non rientra o il piano non cambia. Dashboard → Organization → Usage/Billing.
- Appena la restrizione cade, il tick (ogni 20 s) riparte da solo e il job `plan` viene eseguito:
  nessun altro intervento richiesto. Verifica: `select catalog_import_status('pokemon')`.

## Answer

(da compilare alla chiusura: conteggi di serie, set, stampe, nodi, archi, errori, durata)
