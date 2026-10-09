# Attribution and licenses

Constellation TCG shows third-party data. This file says whose it is, where it comes from and under
which terms, and how the interface exposes that. Every adapter declares its own credits in its
`TCGDefinition.attribution`; the API (`GET /api/games`), the footer of every page, the help page and
the explorer read them from there, so a new game cannot ship without them.

## Pokémon Trading Card Game

- **Data source**: [TCGdex](https://tcgdex.dev), a free, community-maintained Pokémon TCG database
  and API (no key, no published rate limits; local caching is what its FAQ asks for, and the
  snapshot ingestion does exactly that). The card database is published under the **MIT License**:

  > MIT License — Copyright (c) 2021 TCGdex
  > ([full text](https://github.com/tcgdex/cards-database/blob/master/LICENSE))

  Its only condition is that this notice stays with the data, which the platform redistributes in
  substantial part through its API and graph; the notice therefore lives in the adapter
  (`attribution.source.license`) and is shown in the footer and the help page. TCGdex has no written
  terms beyond that license and its FAQ. Prices present in the source payloads are stripped at
  ingestion and never stored.
- **Images**: the MIT license covers the data repository only, not the card scans, which TCGdex hosts
  separately and does not license. They stay the property of The Pokémon Company and are loaded by
  link from `assets.tcgdex.net` at the sizes TCGdex publishes (`low`/`high`, WebP); the platform
  stores and hosts no card image. A set without a logo shows the classic Base Set logo as a stand-in,
  labelled as such in the data (that logo is itself a trademark).
- **Rights holders**: ©1995–2026 Nintendo/Creatures Inc./GAME FREAK inc. Pokémon and Pokémon
  character names are trademarks of Nintendo. Card images, set logos and symbols are the property of
  The Pokémon Company International.
- **Disclaimer**: Constellation is an unofficial, non-commercial fan project, not produced, endorsed,
  supported or affiliated with Nintendo, Creatures Inc., GAME FREAK inc., The Pokémon Company
  (International) or TCGdex. No prices are shown and nothing is sold.
- **Research**: how these terms were established, with sources and the limits of the check, is in
  the phase-2 research note on TCGdex terms and trademarks (`.scratch/fase-2/research/`, 9 October
  2026). It is not legal advice.

## Ownership providers

- **Blockscout** public REST APIs (EVM chains): public explorer data, no key, read only. Token
  payloads lose every market-looking field before storage.
- **Solana** JSON-RPC (DAS when an endpoint is configured, the public mainnet RPC otherwise):
  on-chain token accounts and Metaplex metadata; off-chain metadata fetched by its URI.
- Wallet addresses, signatures and ownership rows are visible only to their owner (row level
  security) and never shown to others.

## Code and typefaces

- Source code: MIT (see `LICENSE`).
- Open-source dependencies: listed by license in [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)
  (`pnpm licenses:notices` regenerates it).
- Typefaces Figtree and Source Serif 4: SIL Open Font License 1.1, self-hosted by `next/font`.

## Before a public launch

Per the master specification (chapter 105), confirm with a lawyer: trademark use in a
non-commercial fan context; card images, set symbols and logos (no license covers them; the 2010
dispute between The Pokémon Company International and Beckett shows that card images next to prices
and a marketplace are the sensitive point, which this platform avoids by design); artist names;
Blockscout and RPC providers' terms. TCGdex itself grants only the MIT license on the data: do not
assume that a public API grants commercial rights, and tell TCGdex about the project and the expected
image traffic before a launch (`contact@tcgdex.net` or its Discord). No disclaimer grants rights.
