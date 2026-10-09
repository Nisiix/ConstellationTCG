/**
 * Labels in the sky are drawn with one bundled font (`public/fonts/Figtree-Medium.ttf`). A
 * character it lacks makes the text builder fetch a fallback font from a CDN, which the content
 * security policy blocks, so labels keep to what the font can draw. The panels show the real name.
 */

/** Code points in Figtree Medium's character map (hex ranges, read from the font's `cmap`). */
const FIGTREE_RANGES =
  'd 20-7e a0-ac ae-113 116-127 12a-12b 12e-137 139-13e 141-148 14a-14d 150-161 164-165 16a-17e 1cd-1ce 218-21b 237 2c6-2c7 2d8-2dd 300-304 306-308 30a-30c 312 326-328 1e80-1e85 1e9e 1ef2-1ef3 2013-2014 2018-201a 201c-201e 2020-2022 2026 2039-203a 2044 2070 2074-2079 2080-2089 20ac 20b9 2122 215b-215e 2190-2193 2196-2199 2212 2215 2260 2264-2265'
    .split(' ')
    .map((range) => {
      const [from, to] = range.split('-').map((hex) => parseInt(hex, 16)) as [number, number?]
      return [from, to ?? from] as const
    })

export function coveredBySkyFont(codePoint: number): boolean {
  return FIGTREE_RANGES.some(([from, to]) => codePoint >= from && codePoint <= to)
}

/** How card names are read aloud when the symbol itself cannot be drawn. */
const SPOKEN: Record<string, string> = {
  '♀': ' F',
  '♂': ' M',
  δ: ' Delta',
  '☆': ' Star',
  '★': ' Star',
  '◇': ' Prism Star',
}

export function skyLabel(name: string): string {
  let out = ''
  for (const ch of name) {
    const spoken = SPOKEN[ch]
    if (spoken !== undefined) out += spoken
    else if (coveredBySkyFont(ch.codePointAt(0) ?? 0)) out += ch
  }
  const label = out.replace(/\s+/g, ' ').trim()
  return label || '·'
}
