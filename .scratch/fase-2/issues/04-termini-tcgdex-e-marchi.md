# Termini d'uso di TCGdex e uso dei marchi in un progetto fan non commerciale

Type: research
Status: resolved
Blocked by: —

## Question

Quali condizioni pone TCGdex (dati e link alle immagini, attribuzione, ridistribuzione, caching)
e quali limiti ragionevoli valgono per nomi, illustrazioni e loghi Pokémon in un progetto pubblico
non commerciale senza prezzi né vendite. Cosa va cambiato, se qualcosa, nelle attribuzioni già
esposte (`docs/legal/ATTRIBUTION.md`, footer, help) prima di un annuncio pubblico.

## Answer

Nota completa: [`../research/04-termini-tcgdex-e-marchi.md`](../research/04-termini-tcgdex-e-marchi.md)
(9 ottobre 2026; fonti TCGdex lette da GitHub, siti Pokémon e fan site solo da snippet perché il
proxy li blocca; non è consulenza legale).

- **Dati TCGdex: MIT** ("Copyright (c) 2021 TCGdex"). Unica condizione: conservare l'avviso.
  Nessun vincolo non commerciale, nessun obbligo di attribuzione oltre l'avviso, nessuna pagina di
  termini (il vecchio `termsUrl` puntava alla home, che non ne parla).
- **Immagini: nessuna licenza.** Il repository contiene solo dati e server; gli scan sono ospitati a
  parte e restano di The Pokémon Company. Uso documentato = link diretto a `assets.tcgdex.net`
  (`low`/`high`, WebP consigliato). API senza chiave, nessun limite pubblicato, caching incoraggiato:
  l'ingestione a snapshot è in linea.
- **Prassi fan**: riga ufficiale "©1995–2026 Nintendo/Creatures Inc./GAME FREAK inc. TM, ®, and
  character names are trademarks of Nintendo"; i fan site aggiungono "card images are the property
  of The Pokémon Company International" e "not produced, endorsed, supported or affiliated". Il
  punto sensibile (caso Beckett, 2010) sono immagini accanto a prezzi e vendite, che qui non ci sono.
- **Applicato in questa sessione**: campo opzionale `license` su `Attribution.source`; adapter
  Pokémon con licenza nominata e avviso MIT, `termsUrl` alla `LICENSE`, immagini dichiarate linkate
  e mai archiviate, titolari nella forma ufficiale, disclaimer "not produced, endorsed, supported or
  affiliated with Nintendo, Creatures Inc., GAME FREAK inc., The Pokémon Company (International) or
  TCGdex"; footer e help mostrano la licenza; help corretto ("never queries the TCGdex API", le
  immagini sì a ogni visita); README e `docs/legal/ATTRIBUTION.md` riscritti, con la sezione
  "Before a public launch" che ora chiede la conferma di un legale e di avvisare TCGdex.
- **Resta al proprietario**: conferma legale prima dell'annuncio; avviso a TCGdex
  (`contact@tcgdex.net` / Discord) del progetto e del volume di immagini linkate.
