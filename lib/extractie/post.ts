/**
 * De vorm van een Instagram-post zoals de rest van de extractie 'm ziet, en
 * het lezen van het antwoord van de scraper. Puur (geen fetch, geen
 * omgevingsvariabelen), zodat het vanuit de app-tests te testen is.
 */

export interface SocialPost {
  soort: 'foto' | 'carrousel' | 'video'
  onderschrift: string
  /** De eerste frame of de omslag; ook bij een video. */
  afbeeldingen: string[]
  videoUrl: string | null
  /** Met @ ervoor. */
  account: string | null
  url: string
}

const tekst = (w: unknown): string | null => (typeof w === 'string' && w.trim() ? w.trim() : null)

/** Leest het antwoord van de scraper; tolerant voor veldnamen, want die wisselen per versie. */
export function leesPost(items: unknown, url: string): SocialPost | null {
  const lijst = Array.isArray(items) ? items : items && typeof items === 'object' ? [items] : []
  const item = lijst.find((i) => i && typeof i === 'object' && !('error' in (i as object))) as Record<string, unknown> | undefined
  if (!item) return null

  const type = String(item.type ?? item.productType ?? '').toLowerCase()
  const kinderen = Array.isArray(item.childPosts) ? item.childPosts as Record<string, unknown>[] : []
  const afbeeldingen = [
    ...(Array.isArray(item.images) ? item.images.filter((i): i is string => typeof i === 'string') : []),
    ...kinderen.map((k) => tekst(k.displayUrl) ?? tekst(k.imageUrl)).filter((s): s is string => Boolean(s)),
  ]
  const omslag = tekst(item.displayUrl) ?? tekst(item.imageUrl) ?? tekst(item.thumbnailUrl)
  if (afbeeldingen.length === 0 && omslag) afbeeldingen.push(omslag)
  const videoUrl = tekst(item.videoUrl) ?? kinderen.map((k) => tekst(k.videoUrl)).find(Boolean) ?? null

  const soort: SocialPost['soort'] = videoUrl && (type.includes('video') || type.includes('clip') || type === '' || type.includes('reel'))
    ? 'video'
    : type.includes('sidecar') || type.includes('carousel') || afbeeldingen.length > 1 ? 'carrousel' : 'foto'

  const account = tekst(item.ownerUsername) ?? tekst((item.owner as Record<string, unknown> | undefined)?.username)
  return {
    soort,
    onderschrift: tekst(item.caption) ?? tekst(item.text) ?? '',
    afbeeldingen: [...new Set(afbeeldingen)].slice(0, 6),
    videoUrl: soort === 'video' ? videoUrl : null,
    account: account ? `@${account.replace(/^@/, '')}` : null,
    url: tekst(item.url) ?? url,
  }
}
