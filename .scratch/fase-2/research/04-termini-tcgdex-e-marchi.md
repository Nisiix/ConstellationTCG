# Termini TCGdex e marchi Pokémon — ricerca

Ticket: `../issues/04-termini-tcgdex-e-marchi.md` · Data: 2026-10-09 · Non è consulenza legale.

Limite: il proxy blocca i siti TCGdex, Pokémon, Nintendo e i fan site (elenco in fondo). Le fonti
TCGdex sono state lette dai repository GitHub; per Pokémon e fan site ci si è basati su snippet di
ricerca, segnalati come tali.

## 1. Licenza e termini di TCGdex

- **Dati: MIT.** `LICENSE` del repo `cards-database` = "MIT License — Copyright (c) 2021 TCGdex";
  README: "The Database is licensed under the MIT License." Unica condizione: conservare l'avviso di
  copyright nelle copie o porzioni sostanziali. Nessun vincolo non commerciale, nessun obbligo di
  attribuzione oltre all'avviso. Anche l'SDK JavaScript è MIT (`LICENSE.md`; il README dice "IT
  License", refuso).
- **Immagini: nessuna licenza dichiarata.** Il repo contiene solo `data`, `data-asia`, `meta`,
  `server`, `scripts`: le immagini non vi sono, quindi la MIT non le copre. La FAQ le dice "hosted
  separately", contribuite via Discord come scan PNG/WebP. I diritti restano a The Pokémon Company;
  TCGdex le serve, non le licenzia.
- **API libera, nessuna chiave, nessun limite pubblicato** (FAQ): "The TCGdex API is free to use and
  requires no API key." / "There are no published hard rate limits, but please be considerate. For
  bulk data needs, cache responses locally rather than fetching the same data repeatedly." Il caching
  è quindi incoraggiato: l'ingestione a snapshot è in linea. Il server imposta
  `Access-Control-Allow-Origin: *` e non contiene rate limiting.
- **Asset** (`docs/assets.mdx`): URL senza estensione; carte `…/{quality}.{extension}` con `high`
  600×825 e `low` 245×337, estensioni `png`, `webp` ("highly recommended" per il web), `jpg`
  (sconsigliato); loghi e simboli `logo.{ext}` / `symbol.{ext}`. Nessuna regola su hotlinking, banda
  o CDN: il nostro uso (link diretto, `webp`) è quello documentato. Non esiste una pagina "terms":
  l'attuale `termsUrl: https://tcgdex.dev/` non parla di termini.
- Home della documentazione: "Every bit of information from your Cards freely available and open
  source !"; chiede sponsorizzazioni perché l'API "is expensive to run".

## 2. Disclaimer di TCGdex sui marchi

README di `cards-database`: **"This database is not produced, endorsed, supported or affiliated with
Nintendo or The Pokémon Company."** Nessun altro disclaimer nella documentazione, nell'SDK o nel
profilo dell'organizzazione (ricerca di "Nintendo", "affiliated", "trademark": zero risultati).

## 3. Prassi dei progetti fan non commerciali

- Riga ufficiale (snippet da pagine pokemon.com, Pokémon Center, Play! Pokémon): "©2026 Pokémon.
  ©1995–2026 Nintendo/Creatures Inc./GAME FREAK inc. TM, ®, and character names are trademarks of
  Nintendo." Non è stata trovata alcuna policy TPCi per fan site o database di carte.
- Fan site (snippet): PokeBeach — "English card images appearing on this website are the property of
  The Pokémon Company International, Inc." + "not official in any shape or form, nor affiliated,
  sponsored, or otherwise endorsed"; PkmnCards — testi e immagini "copyright The Pokémon Company,
  Nintendo, Game Freak, Creatures, and/or Wizards of the Coast" (carte 1999–2003), "not produced by,
  endorsed by, supported by, or affiliated with"; Pokedexia — "unofficial fan project", "no intent to
  create confusion with the official brands", cita le fonti dati.
- Le Nintendo Game Content Guidelines riguardano video/screenshot di gameplay su piattaforme di
  condivisione, non siti o database.
- Precedente: TPCi v. Beckett Media (2010), immagini di carte in una guida prezzi commerciale con
  marketplace, dopo richieste di rimozione ignorate; rivista chiusa. Le immagini in contesto
  commerciale/prezzi sono il punto sensibile. Constellation (niente prezzi né vendite, immagini
  linkate e non ospitate) è nella posizione più difendibile, ma nessun disclaimer concede diritti:
  **un avvocato deve confermare prima del lancio pubblico.**

## 4. Confronto con quanto esposto oggi e modifiche proposte

Oggi: `ATTRIBUTION.md`, `manifest.ts`, footer, help (#data), HUD ("Data: TCGdex · © Pokémon"),
landing ("data from TCGdex"). Sostanza corretta; precisione migliorabile:

1. **Nominare la licenza** in `attribution.source.terms` e in ATTRIBUTION.md: "Card data under the MIT
   License (© 2021 TCGdex). Card images are not covered by that license: they stay © The Pokémon
   Company and are linked from assets.tcgdex.net, never stored." `termsUrl` →
   `https://github.com/tcgdex/cards-database/blob/master/LICENSE`. Valutare un campo opzionale
   `license` in `Attribution` (`packages/domain/src/adapter-contracts.ts`).
2. **Riprodurre l'avviso MIT** ("Copyright (c) 2021 TCGdex — MIT License") in ATTRIBUTION.md:
   `THIRD_PARTY_NOTICES.md` copre solo i pacchetti npm, e noi ridistribuiamo porzioni sostanziali dei
   dati via API e grafo.
3. **Allineare il disclaimer** alla formula TCGdex ed estendere i soggetti: "Constellation is an
   unofficial, non-commercial fan project, not produced, endorsed, supported or affiliated with
   Nintendo, Creatures Inc., GAME FREAK inc., The Pokémon Company (International) or TCGdex. No
   prices are shown and nothing is sold."
4. **`rightsHolders` nel formato ufficiale**: "©1995–2026 Nintendo/Creatures Inc./GAME FREAK inc.
   Pokémon and Pokémon character names are trademarks of Nintendo. Card images are the property of
   The Pokémon Company International." (anno aggiornato o calcolato).
5. **Help, voce Source**: "the site never queries the source while you browse" è inesatto, le immagini
   sono caricate da `assets.tcgdex.net` a ogni visita. Riscrivere: "the site never queries the
   TCGdex API while you browse; card images are loaded from TCGdex's asset host at the sizes it
   publishes".
6. **"used as provided by TCGdex, with attribution, and never resold"** → sostituire con la frase del
   punto 1; l'attribuzione è una scelta nostra, non un obbligo MIT.
7. HUD e landing: la forma breve va bene.
8. **"Before a public launch"**: annotare che TCGdex non ha termini scritti oltre MIT e FAQ, che le
   immagini non hanno licenza, che conviene avvisare TCGdex (contact@tcgdex.net / Discord) del
   progetto e del volume di hotlinking, e che il logo Base Set segnaposto è anch'esso un marchio.

## Fonti consultate

- https://raw.githubusercontent.com/tcgdex/cards-database/master/LICENSE — MIT, © 2021 TCGdex.
- https://github.com/tcgdex/cards-database — README: MIT, disclaimer Nintendo/TPC, struttura repo senza immagini.
- https://raw.githubusercontent.com/tcgdex/cards-database/master/CONTRIBUTING.md — i contributori garantiscono di avere i diritti sui contenuti; nulla sulle immagini.
- https://raw.githubusercontent.com/tcgdex/documentation/master/src/content/docs/faq.mdx — nessuna API key, nessun rate limit pubblicato, caching consigliato, immagini contribuite via Discord.
- https://raw.githubusercontent.com/tcgdex/documentation/master/src/content/docs/assets.mdx — pattern URL, qualità, estensioni.
- https://raw.githubusercontent.com/tcgdex/documentation/master/src/content/docs/index.mdx — "freely available and open source", sponsorship.
- https://raw.githubusercontent.com/tcgdex/documentation/master/src/content/docs/sdks/javascript.mdx — `getImageURL(quality, extension)`, `setCacheTTL`.
- https://github.com/tcgdex/javascript-sdk e `…/master/LICENSE.md` — MIT.
- https://github.com/orgs/tcgdex/repositories, https://github.com/tcgdex — elenco repo, nessun disclaimer di organizzazione.
- GitHub code search su `tcgdex/cards-database` (`server/src/index.ts`: CORS `*`, nessun rate limit) e `tcgdex/documentation` (nessuna occorrenza di Nintendo/affiliated/trademark).
- Snippet di ricerca: pokemon.com/us/legal/information, pokemoncenter.com/en-gb/legal-info (riga ©); pokebeach.com, pkmncards.com/about, pokedexia.com/en/legal-notice (disclaimer); nintendo.co.jp/networkservice_guideline (ambito); bulbanews / themarysue / patentarcade (caso Beckett).
- Non raggiunti (bloccati dal proxy, nessun contenuto letto): tcgdex.dev, api.tcgdex.net, assets.tcgdex.net, tcgdex.net, npmjs.com (403), api.apis.guru, pokemon.com, nintendo.co.jp/.com/.co.uk, docs.pokemontcg.io, pokemontcg.io, bulbapedia, pokebeach, serebii, pkmncards, pokedexia, pokumon, limitlesstcg, web.archive.org.
