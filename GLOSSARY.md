# Glossary

The words of Constellation TCG, fixed so that the interface, the code and the conversations say
the same thing. Code identifiers in parentheses. A term here is never redefined elsewhere.

**Sky** (`scene`, the explorer's 3D view) — The public picture of the graph: points and lines,
identical for everyone, with or without an account. Not to be confused with *My Constellation*,
which only colors part of it.

**Point** (`GraphNode`) — Anything that can be in focus: a card, a printing, a set, a series, the
game, a Pokémon species, an artist, an energy type. Its contour color says what it is.

**Connection** (`GraphEdge`, `relationshipType`) — A typed line between two points: *belongs to*,
*printing of*, *reprint of*, *evolution of*, *illustrated by*, *same Pokémon*, *has type*… The
relationship is the product; a connection is never a statistic.

**Card** (`card_identity`) — What a card *is*, whatever set it was printed in: Charizard, the Base
Set Charizard and the Evolutions Charizard are one card. Identified by its name and kind within a
game; a source renaming it, or printing it in another language, does not make a second card.

**Printing** (`card_printing`) — One card as printed in one set, in one language: number, rarity,
artist, image. The thing people own. A card has one or more printings.

**Reprint** (`REPRINT_OF`) — A later printing of a card, pointing at the card's first printing.
The first printing is the hub of all its reprints across sets.

**Focus** (`focusNodeId`) — The point the sky is arranged around right now. The URL always names
it (`?node=`), so a view can be shared.

**Neighborhood** (`GraphNeighborhood`) — The focus and its connections up to a depth (Direct = 1,
Extended = 2, Deep = 3), bounded so the sky never shows thousands of points. By default it holds
cards, sets, series, the game and the artist; the *Node type* filter widens it.

**Universe** — The top of the sky: the game, its series and its sets, newest first. No focus card.

**My Constellation** (`ownership` overlay) — The signed-in person's light on the sky: the points
that match what they own glow in the ownership color, and nothing else changes. Fed by linked
wallets and declared cards. Not a collection, a binder or a portfolio; it has no quantities on
display and no values.

**Constellation** (`constellationStats.constellations`) — One group of a person's owned cards that
share a connection: the same set, Pokémon, artist, card or reprint line. A person's constellations
are counted, never valued.

**Wallet** (`wallets`) — An address a person has linked to their account and proved to control by
signing a one-time challenge. A wallet is a means to read ownership, never an identity on display.

**Asset** (`digital_assets`) — A token as a provider reports it (platform, chain, contract, token
id, metadata with market fields removed). The *resolver* decides which printing it represents:
*resolved*, *ambiguous* (plausible printings for the owner to pick from) or *unresolved*.

**Declared card** (`manual` platform) — A printing a person says they own, without any wallet.
Treated like any other owned asset, resolved with full confidence to itself.

**Provider** (`OwnershipProvider`) — Where ownership is read from: EVM chains through Blockscout,
Solana through a DAS endpoint or the public RPC, declared cards. Providers never touch the core.

**Adapter** (`TCGAdapter`) — Everything that is specific to one game: source, normalization,
identity rules, relationships, theme, filters, attribution. Adding a game is adding an adapter.

**Attribution** (`TCGDefinition.attribution`) — The credits a game's data requires: source and its
terms, rights holders, disclaimer. Shown wherever the data is.
