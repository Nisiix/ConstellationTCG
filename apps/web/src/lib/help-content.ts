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
    text: 'any connection by clicking it, in the scene or in the panel on the right. A card leads to the same card in other sets, to the same Pokémon, to its evolutions in the same set, to the same Pokémon in earlier sets that look alike, and to its artist; a set leads to its cards and to the sets that share its Pokémon, its artists or its make-up. Two cards are never connected just for sitting in the same set or sharing an energy type. A panel lists a few of each kind; Show all opens every one of them on a page of its own, and Back returns. Hovering a group or a row in the panel lights up those points in the scene; hovering a point names its connection to the focus.',
  },
  { title: 'Go wider', text: 'with Extended connections (bottom right): the cards reached through the same card, the same Pokémon or the same artist. Or narrow down with filters.' },
  {
    title: 'Keep your thread.',
    text: 'The sky never resets: every point you visit leaves a trail of light behind you, the last twelve steps bright and older ones fading. Your thread (bottom left) lists them in order; pick one to go back there. It lives in this browser tab only and is never sent anywhere.',
  },
  {
    title: 'Connect two points.',
    text: 'Connect to… (in the panel of any point) asks for a second card, set or artist and shows the shortest path between them through cards, sets, series and artists, one line per connection. Walk it with ← → or a click; Search further looks up to eight steps away. Share the path as /thread/<a>/<b>: it is worked out again whenever the link is opened.',
  },
  { title: 'Share', text: 'any view: the link holds the focus, the depth and the filters.' },
  {
    title: 'Make it yours.',
    text: 'My Constellation (top right): sign in with an email link, link a wallet by signing a free message, or mark the cards you own. They glow gold in the sky. Searching and exploring never need an account; nothing here shows a price.',
  },
]

export const SHORTCUTS: Array<[key: string, label: string]> = [
  ['/', 'Search'],
  ['← →', 'Walk the connections (or the steps of a path)'],
  ['Enter', 'Fly to the one in hand'],
  ['E', 'Widen the connections'],
  ['C', 'Direct connections only'],
  ['F', 'Filters'],
  ['L', 'Switch 3D / list'],
  ['U', 'Back to the universe'],
  ['⌫', 'Go back'],
  ['Esc', 'Close panels'],
  ['?', 'This help'],
]
