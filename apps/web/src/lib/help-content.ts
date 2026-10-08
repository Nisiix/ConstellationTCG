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
  { title: 'Follow', text: 'any connection by clicking it, in the scene or in the panel on the right.' },
  { title: 'Go wider', text: 'with “Show more” (extended and deep connections) or narrow down with filters.' },
  { title: 'Share', text: 'any view: the link holds the focus, the depth and the filters.' },
]

/** `⌘` is replaced by the platform's modifier label when rendered. */
export const SHORTCUTS: Array<[key: string, label: string]> = [
  ['/', 'Search'],
  ['⌘K', 'Commands'],
  ['E', 'Show more connections'],
  ['C', 'Direct connections only'],
  ['F', 'Filters'],
  ['L', 'Switch 3D / list'],
  ['U', 'Back to the universe'],
  ['⌫', 'Go back'],
  ['Esc', 'Close panels'],
  ['?', 'This help'],
]
