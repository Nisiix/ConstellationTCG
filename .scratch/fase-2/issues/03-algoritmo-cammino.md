# Come si calcola il cammino fra due punti, e a che costo

Type: research
Status: open
Blocked by: —

## Question

Per il cammino fra due punti qualsiasi del grafo (`graph_edges`, ~20k stampe e centinaia di
migliaia di archi a catalogo completo): quale algoritmo (BFS bidirezionale in SQL ricorsiva su
PostgreSQL/PGlite, oppure BFS in memoria su un indice di adiacenza caricato una volta per gioco),
con quale profondità massima ragionevole (6? 8?), quali tipi di relazione come ponte di default
(carte, set, serie, artista come nel vicinato) e quale costo in tempo e memoria sul server (Vercel
serverless) e su PGlite. Serve una raccomandazione motivata e una stima, non codice.

## Answer

(il risultato va in `../research/03-algoritmo-cammino.md`; qui la sintesi)
