# Come si chiede e si mostra il cammino fra due punti

Type: grilling
Status: resolved
Blocked by: — (03 risolto: ponti di default, profondità 6/8 e risposta "nessun cammino" già
raccomandati nella sua `## Answer`; qui si decide il gesto e la resa, non l'algoritmo)

## Question

Decidere: (1) il gesto per chiedere un cammino (seconda ricerca "verso…" nella barra; pulsante
"Collega a…" nel pannello del focus; trascinare un risultato sul focus); (2) come si mostra: la
camera vola tappa per tappa o il cammino appare tutto e poi si percorre; una riga per arco ("Charizard
è illustrata da Mitsuhiro Arita, che ha illustrato Pikachu"); (3) quali relazioni fanno da ponte
di default (carte, set, serie, artista) e se il filtro Node type cambia il cammino; (4) cosa dire
quando non c'è cammino entro la profondità massima; (5) l'indirizzo `/thread/<a>/<b>` e cosa porta
con sé (vista, profondità); (6) il cammino nella vista List.

## Answer

Grilling del 9 ottobre 2026 (sera), risposte del proprietario:

1. **Gesto** → pulsante **"Connect to…"** nel pannello del focus: apre una ricerca, si sceglie il
   secondo punto e parte il cammino.
2. **Resa** → il cammino **appare tutto** (tappe + scia), la camera inquadra l'insieme; poi lo si
   **percorre** tappa per tappa (frecce ←/→ o click).
3. **Spiegazione** → **etichetta compatta** per arco: "Charizard — illustrated by → Mitsuhiro Arita".
4. **Ponti** → **fissi**, quelli della ricerca 03 (carte, stampe, set, serie, artista; archi
   BELONGS_TO, PART_OF, PRINTING_OF, ILLUSTRATED_BY, REPRINT_OF, EVOLVES_FROM, EVOLUTION_OF; il
   gioco solo come estremo). Il filtro Node type **non** cambia il cammino.
5. **Nessun cammino entro 6** → avviso **"No path within 6 steps"** con un pulsante **"Search
   further"** che riprova fino a 8 (i ponti restano fissi).
6. **Indirizzo** → `/thread/<a>/<b>` porta **solo i due estremi e la vista** (`?view=list`);
   ricalcolato all'apertura, profondità sempre 6 → 8 su richiesta.
7. **Vista List** → **elenco numerato** di tappe con l'etichetta dell'arco fra una e l'altra, ogni
   tappa cliccabile.
8. **Cammino e filo** → percorso, il cammino **si aggiunge al filo**.
