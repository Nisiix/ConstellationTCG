# Attribution and licenses

Constellation TCG shows third-party data. This file says whose it is, where it comes from and under
which terms, and how the interface exposes that. Every adapter declares its own credits in its
`TCGDefinition.attribution`; the API (`GET /api/games`), the footer of every page, the help page and
the explorer read them from there, so a new game cannot ship without them.

## Pokémon Trading Card Game

- **Data source**: [TCGdex](https://tcgdex.dev), an open, community-maintained Pokémon TCG database
  and API. Card data and image links are used as provided by TCGdex, with attribution, and never
  resold. Prices present in the source payloads are stripped at ingestion and never stored.
- **Rights holders**: Pokémon, card names, artwork, set logos and symbols are © Nintendo, Creatures
  Inc., GAME FREAK inc. and The Pokémon Company International.
- **Disclaimer**: Constellation is an unofficial, non-commercial fan project. It is not affiliated
  with, endorsed or sponsored by The Pokémon Company, Nintendo or TCGdex. No prices are shown and
  nothing is sold.
- **Images**: served from `assets.tcgdex.net` by link; the platform hosts no card images. A set
  without a logo shows the classic Base Set logo as a stand-in, labelled as such in the data.

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

Per the master specification (chapter 105), confirm: TCGdex terms for redistribution of data and
image links; trademark use in a non-commercial fan context; set symbols and logos; artist names;
Blockscout and RPC providers' terms. Do not assume that a public API grants commercial rights.
