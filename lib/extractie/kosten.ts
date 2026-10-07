/**
 * Wat een scan ongeveer kost, in eurocenten, voor de tabel `scan`. Een
 * schatting: de prijzen staan hier vast en de dollar is voor het gemak een
 * euro. Goed genoeg om te zien welke soort import duur is.
 */

/** Dollar per miljoen tokens (in, uit), op naam van het model. */
const CLAUDE_PRIJS: [patroon: RegExp, inPerM: number, uitPerM: number][] = [
  [/haiku/i, 1, 5],
  [/opus/i, 15, 75],
  [/sonnet/i, 3, 15],
]

export function claudeKosten(model: string, tokensIn: number, tokensUit: number): number {
  const [, inPerM, uitPerM] = CLAUDE_PRIJS.find(([p]) => p.test(model)) ?? [null, 3, 15]
  return ((tokensIn * inPerM + tokensUit * uitPerM) / 1_000_000) * 100
}

/** Eén post ophalen bij de scraper: ongeveer $2,50 per duizend. */
export const SCRAPER_KOSTEN = 0.3
/** Eén video uitschrijven: een reel van een minuut tegen $0,003 per minuut, plus wat marge. */
export const TRANSCRIPTIE_KOSTEN = 1
