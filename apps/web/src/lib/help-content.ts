/** Help content shared by the in-explorer overlay and the /help page. */

export interface HelpStep {
  title: string
  text: string
}

export const HOW_IT_WORKS: HelpStep[] = [
  { title: 'Search', text: 'a card, a set, a Pokémon or an artist. The camera flies there.' },
  {
    title: 'Look around.',
    text: 'The points around the focus are its connections: drag to orbit, scroll to zoom, hover for names.',
  },
  {
    title: 'Read the colors.',
    text: 'Every point is outlined in the color of what it is (sets and series in the brand color, cards and artists in white); the lines carry the same colors. The legend at the bottom spells it out.',
  },
  {
    title: 'Follow',
    text: 'any connection by clicking it, in the scene or in the panel on the right: other cards (printings, reprints, evolutions), the sets and series they belong to, and the artist, who leads to the other cards they illustrated. Pokémon species and energy types stay out of the way unless the Node type filter asks for them. Hovering a group or a row in the panel lights up those points in the scene; hovering a point names its connection to the focus.',
  },
  { title: 'Go wider', text: 'with Extended or Deep connections (bottom right) or narrow down with filters.' },
  { title: 'Share', text: 'any view: the link holds the focus, the depth and the filters.' },
  {
    title: 'Make it yours.',
    text: 'My Constellation (top right): sign in with an email link, link a wallet by signing a free message, or mark the cards you own. They glow gold in the sky. Searching and exploring never need an account; nothing here shows a price.',
  },
]

export const SHORTCUTS: Array<[key: string, label: string]> = [
  ['/', 'Search'],
  ['E', 'Widen the connections'],
  ['C', 'Direct connections only'],
  ['F', 'Filters'],
  ['L', 'Switch 3D / list'],
  ['U', 'Back to the universe'],
  ['⌫', 'Go back'],
  ['Esc', 'Close panels'],
  ['?', 'This help'],
]
