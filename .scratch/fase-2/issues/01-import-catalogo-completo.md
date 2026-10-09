# Import completo del catalogo Pokémon su Supabase

Type: task
Status: open
Blocked by: —
Owner: proprietario del repository (richiede una macchina con rete: TCGdex non è raggiungibile dall'ambiente degli agenti)

## Question

Portare il catalogo Pokémon completo (tutte le serie, i set, le carte) nel database di produzione
e ricostruire il grafo, così che filo e cammino si vedano su dati reali e non sul solo Base Set.

## Checklist

1. Nel dashboard Supabase (progetto `xtebcuuipklenukpsoyp`, eu-west-1) copiare la connection
   string "direct" (`db.xtebcuuipklenukpsoyp.supabase.co:5432`), con la password del database.
2. Nel clone locale, in `.env`:
   `DATABASE_URL=postgresql://postgres:<password>@db.xtebcuuipklenukpsoyp.supabase.co:5432/postgres`
   (le chiavi pubbliche `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` sono già in
   `.env.example`).
3. `pnpm install`, poi `pnpm catalog:refresh` (= `pnpm ingest && pnpm graph:build`). Durata:
   diversi minuti; gli errori finiscono in `ingestion_errors`, non interrompono.
4. Verificare: `GET /api/health` del sito (o la query `select count(*) from card_printings`) deve
   mostrare decine di migliaia di stampe; `/explore` deve elencare tutte le serie.
5. Scrivere qui sotto, in `## Answer`, conteggi e data.

## Answer

(da compilare alla chiusura)
