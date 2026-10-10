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
    text: 'The sky never resets: every point you visit leaves a trail of light behind you, the last twelve steps bright and older ones fading. Your thread (bottom left) lists them in order; pick one to go back there, or walk it with [ and ] without adding steps. It lives in this browser tab only and is never sent anywhere.',
  },
  {
    title: 'Connect two points.',
    text: 'Connect to… (in the panel of any point) asks for a second card, set or artist and shows the shortest path between them through cards, sets, series and artists, one line per connection. Walk it with ← → or a click; Search further looks up to eight steps away. Share the path as /thread/<a>/<b>: it is worked out again whenever the link is opened.',
  },
  {
    title: 'Travel in time.',
    text: 'Time (bottom right, or T) shows the sky as it stood at the end of a year and plays the years forward: what was not out yet steps away, what came out that year shines brighter and is marked new in the lists. Drag the slider or step a year at a time; All of time puts it away. It works on any view, the universe, a card, a genealogy.',
  },
  {
    title: 'Read a genealogy.',
    text: 'Genealogy (in the panel of a Pokémon or a card, or G) shows its evolution line on top, every expansion it was printed in from the oldest (left) to the newest, a few printings each, and the artists who drew it below. In the list it reads as a timeline, newest first. Pick another member of the line to open its own genealogy; anything else takes you back to the sky.',
  },
  {
    title: 'Start from the landmarks.',
    text: 'Landmarks (bottom right) gathers the points worth knowing first, each with its reason: where each era began, the expansions that bridge the most others, the cards printed again and again, the Pokémon that always return, the artists across eras.',
  },
  { title: 'Share', text: 'any view: the link holds the focus, the depth, the filters, the year and the view (genealogy, landmarks).' },
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
  ['[ ]', 'Back / forward along your thread'],
  ['T', 'Time: play the years / all of time'],
  ['G', 'Genealogy of the point in hand'],
  ['⌫', 'Go back'],
  ['Esc', 'Close panels'],
  ['?', 'This help'],
]
