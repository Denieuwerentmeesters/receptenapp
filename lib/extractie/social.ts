/**
 * Een Instagram-post ophalen voor api/extraheer.ts (Instagram-route).
 *
 * Alles loopt door `haalSocialPost`, zodat we van scraperdienst kunnen
 * wisselen zonder dat de rest het merkt. Nu: een scraper op Apify, alleen
 * openbare posts, uitgelogd, één post per aanroep op verzoek van de
 * gebruiker. Waarom zo en niet via Meta's eigen API staat in het plan
 * (juridische keuzes).
 *
 * Uitzetten kan zonder deploy: INSTAGRAM_IMPORT_AAN=false. Dan krijgt de
 * gebruiker meteen de vraag om een screenshot.
 *
 * Omgevingsvariabelen: APIFY_TOKEN en optioneel APIFY_INSTAGRAM_ACTOR
 * (standaard apify~instagram-scraper).
 */

import { leesPost, type SocialPost } from './post'

export type { SocialPost } from './post'

export function instagramImportAan(): boolean {
  const w = (process.env.INSTAGRAM_IMPORT_AAN ?? 'true').trim().toLowerCase()
  return !(w === 'false' || w === '0' || w === 'uit' || w === 'nee')
}

/** Hoe lang we hooguit op de scraper wachten; daarna liever een nette melding. */
const TIMEOUT_S = 75

export async function haalSocialPost(url: string): Promise<SocialPost> {
  const token = process.env.APIFY_TOKEN
  if (!token) throw new Error('Instagram importeren is nog niet ingesteld op de server (APIFY_TOKEN).')
  const actor = process.env.APIFY_INSTAGRAM_ACTOR || 'apify~instagram-scraper'

  const stop = new AbortController()
  const timer = setTimeout(() => stop.abort(), (TIMEOUT_S + 10) * 1000)
  let items: unknown
  try {
    const respons = await fetch(
      `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&timeout=${TIMEOUT_S}&memory=1024`,
      {
        method: 'POST',
        signal: stop.signal,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ directUrls: [url], resultsType: 'posts', resultsLimit: 1, addParentData: false }),
      },
    )
    if (!respons.ok) {
      const tekst = (await respons.text().catch(() => '')).slice(0, 300)
      console.error('instagram: scraper', respons.status, tekst)
      throw new Error('De post kon niet worden opgehaald. Probeer het later opnieuw, of maak een screenshot.')
    }
    items = await respons.json()
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('Het ophalen van de post duurde te lang. Probeer het opnieuw, of maak een screenshot.')
    }
    throw e
  } finally {
    clearTimeout(timer)
  }

  const post = leesPost(items, url)
  if (!post) {
    throw new Error('Deze post is niet te lezen. Is het account openbaar? Anders: maak een screenshot van het recept.')
  }
  return post
}
