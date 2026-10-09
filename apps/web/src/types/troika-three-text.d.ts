/** The one call the app makes into troika-three-text (drei's `Text` brings the rest). */
declare module 'troika-three-text' {
  export function configureTextBuilder(config: {
    defaultFontURL?: string | null
    unicodeFontsURL?: string | null
    sdfGlyphSize?: number
    sdfMargin?: number
    sdfExponent?: number
    textureWidth?: number
    useWorker?: boolean
  }): void
}
