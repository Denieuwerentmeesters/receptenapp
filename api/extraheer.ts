/**
 * Leest een recept uit en geeft het terug in het schema van de app: van een
 * link (website of Instagram), van screenshots, van een kookboekfoto of van
 * vrije tekst. De app toont daarna het controlescherm; opslaan gebeurt pas
 * daar (app/src/screens/ReceptToevoegen.tsx).
 *
 * Waarom een serverfunctie: de sleutels van Anthropic, OpenAI en de scraper
 * mogen niet in de app-bundle. En dit kost geld per aanvraag, dus:
 *  - alleen voor wie ingelogd is (de sessie die Neon Auth bevestigt);
 *  - een daglimiet per gebruiker tegen misbruik, geteld in de tabel `scan`.
 *    Pinch Plus komt later; nu is importeren gratis.
 *
 * Het antwoord komt als losse regels JSON (één gebeurtenis per regel, zie
 * ScanGebeurtenis in app/src/lib/extractie.ts) zodra de app `stroom: true`
 * meestuurt: eerst de stappen ("Video uitschrijven"), aan het eind het
 * recept. Een Instagram-video duurt zo'n 30 tot 60 seconden; zonder stroom
 * zou de edge-runtime na 25 seconden afbreken en kijk je naar een spinner.
 * Zonder `stroom` (oudere app-builds) komt er één JSON-object terug, zoals
 * vroeger; dat pad doet alleen foto en tekst.
 *
 * Routes:
 *  - Instagram (lib/extractie/social.ts): post ophalen; recept in het
 *    onderschrift → alleen dat; link naar een website → de websiteroute;
 *    video → gesproken tekst uitschrijven (lib/extractie/transcriptie.ts)
 *    plus omslagbeeld en onderschrift; carrousel → de beelden als screenshots.
 *  - Website (lib/extractie/website.ts): het JSON-LD-receptblok, anders de
 *    zichtbare tekst.
 *  - Screenshots en kookboekfoto: de beelden rechtstreeks naar Claude.
 * Wat de server ophaalt (pagina, video, beelden) wordt na het uitlezen
 * weggegooid; alleen het recept, de link en de naam van de maker gaan terug.
 *
 * Omgevingsvariabelen op Vercel: ANTHROPIC_API_KEY, DATABASE_URL,
 * (VITE_)NEON_AUTH_URL; optioneel ANTHROPIC_MODEL_EXTRAHEER, APIFY_TOKEN,
 * APIFY_INSTAGRAM_ACTOR, OPENAI_API_KEY, OPENAI_TRANSCRIBE_MODEL,
 * INSTAGRAM_IMPORT_AAN en SCAN_LIMIET_PER_DAG.
 */

import Anthropic from '@anthropic-ai/sdk'
import { neon, type NeonQueryFunction } from '@neondatabase/serverless'
import { isAppOrigin } from './auth'
import { sessieUserId } from '../lib/sessie'
import { RECEPT_SCHEMA, systeem } from '../lib/extractie/prompt'
import {
  canoniekeUrl, haalWebpagina, leesReceptBlok, receptBlokAlsTekst, siteNaamUit, zichtbareTekst,
} from '../lib/extractie/website'
import { haalSocialPost, instagramImportAan, type SocialPost } from '../lib/extractie/social'
import { schrijfUit } from '../lib/extractie/transcriptie'
import { alsAfbeeldingBlok, haalBestand, isAfbeeldingType } from '../lib/extractie/media'
import type { AfbeeldingType } from '../lib/extractie/media'
import { SCRAPER_KOSTEN, TRANSCRIPTIE_KOSTEN, claudeKosten } from '../lib/extractie/kosten'
import {
  isInstagramUrl, lijktRecept, normaliseerUrl, siteNaam, websiteLinkIn, type Concept, type ConceptBron, type ScanGebeurtenis,
} from '../app/src/lib/importeren'

export const config = { runtime: 'edge' }

/** Wisselen kan zonder deploy. Sonnet 5.5 wil geen gedwongen tool; het schema gaat als output_config mee. */
const MODEL = process.env.ANTHROPIC_MODEL_EXTRAHEER || 'claude-sonnet-5-5'

/** Tegen misbruik, niet als verdienmodel: per gebruiker, per 24 uur, alle pogingen. */
const LIMIET_PER_DAG = Number(process.env.SCAN_LIMIET_PER_DAG) || 30

/** Hooguit zoveel beelden per scan; meer dan vier screenshots is geen recept meer. */
const MAX_BEELDEN = 4
/** Een beeld van Instagram dat we zelf ophalen. */
const MAX_BEELD_BYTES = 5 * 1024 * 1024

type Sql = NeonQueryFunction<false, false>

interface Beeld { mediaType: AfbeeldingType; data: string }

interface Verzoek {
  tekst?: string
  /** Eén kookboekfoto (ook het pad van oudere app-builds). */
  afbeelding?: Beeld
  /** Screenshots, in volgorde. */
  afbeeldingen?: Beeld[]
  url?: string
  /** Antwoord als stroom van gebeurtenissen; zonder komt er één JSON-object. */
  stroom?: boolean
}

type Soort = ConceptBron['soort']

/** Een fout die we de gebruiker letterlijk mogen laten zien. */
class Melding extends Error {}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return fout('Alleen POST.', 405)

  // Geen CORS-headers: alleen de website zelf en de iOS-app mogen dit.
  const origin = request.headers.get('origin')
  const eigen = new URL(request.url).origin
  if (!isAppOrigin(origin) && origin !== eigen) return fout('Niet toegestaan.', 403)

  const sleutel = process.env.ANTHROPIC_API_KEY
  const basis = process.env.NEON_AUTH_URL ?? process.env.VITE_NEON_AUTH_URL
  const databaseUrl = process.env.DATABASE_URL
  if (!sleutel || !basis || !databaseUrl) return fout('De server is niet goed ingesteld.', 500)

  const userId = await sessieUserId(basis, request.headers.get('cookie'), eigen)
  if (!userId) return fout('Je bent niet ingelogd.', 401)

  const gelezen = leesVerzoek(await request.json().catch(() => null))
  if (typeof gelezen === 'string') return fout(gelezen, 400)
  const { verzoek, soort, url } = gelezen

  const sql = neon(databaseUrl)
  let sleutels: string[]
  try {
    const [{ aantal }] = await sql`
      select count(*)::int as aantal from scan
      where user_id = ${userId} and aangemaakt_op > now() - interval '24 hours'
    ` as { aantal: number }[]
    if (aantal >= LIMIET_PER_DAG) {
      return fout(`Je hebt vandaag al ${LIMIET_PER_DAG} recepten laten uitlezen. Morgen kan het weer.`, 429)
    }
    if (url) {
      const [bestaand] = await sql`
        select id from recepten where user_id = ${userId} and url = ${url} limit 1
      ` as { id: string }[]
      if (bestaand) {
        return verzoek.stroom
          ? stroomAntwoord(async (stuur) => stuur({ soort: 'bestaat', receptId: bestaand.id }))
          : fout('Dit recept staat al bij je recepten.', 409, { receptId: bestaand.id })
      }
    }
    sleutels = await productSleutels(sql, userId)
  } catch (e) {
    console.error('extraheer: database', e)
    return fout('Uitlezen lukt nu even niet. Probeer het later opnieuw.', 500)
  }

  const claude = new Anthropic({ apiKey: sleutel })
  const draai = async (stap: (tekst: string) => void): Promise<{ concept: Concept; scanId: string | null }> => {
    const scan: ScanUitkomst = { tokensIn: 0, tokensUit: 0, kosten: 0, route: soort }
    try {
      const concept = await verwerk(claude, sleutels, verzoek, soort, url, scan, stap)
      const scanId = await legScanVast(sql, userId, soort, url, scan, 'gelukt', concept)
      return { concept, scanId }
    } catch (e) {
      await legScanVast(sql, userId, soort, url, scan, 'mislukt', null, e instanceof Error ? e.message : String(e))
      throw e
    }
  }

  if (!verzoek.stroom) {
    // Het oude pad: één JSON-object, voor app-builds van vóór het importeren.
    try {
      const { concept, scanId } = await draai(() => undefined)
      return antwoord({ ...concept, scanId }, 200)
    } catch (e) {
      console.error('extraheer', e)
      return fout(meldingVoor(e), 502)
    }
  }

  return stroomAntwoord(async (stuur) => {
    try {
      const { concept, scanId } = await draai((tekst) => stuur({ soort: 'stap', tekst }))
      stuur({ soort: 'klaar', concept, scanId })
    } catch (e) {
      console.error('extraheer', e)
      stuur({ soort: 'fout', fout: meldingVoor(e) })
    }
  })
}

/* ----------------------------------------------------------------- routes */

interface ScanUitkomst {
  tokensIn: number
  tokensUit: number
  /** Eurocenten, schatting (lib/extractie/kosten.ts). */
  kosten: number
  /** Welke weg het nam: 'onderschrift', 'video', 'carrousel', 'website-jsonld', … */
  route: string
}

type Inhoud = Anthropic.Messages.ContentBlockParam[]

async function verwerk(
  claude: Anthropic, sleutels: string[], verzoek: Verzoek, soort: Soort, url: string | null,
  scan: ScanUitkomst, stap: (tekst: string) => void,
): Promise<Concept> {
  if (soort === 'instagram' && url) return viaInstagram(claude, sleutels, url, scan, stap)
  if (soort === 'website' && url) {
    const { inhoud, bron } = await websiteInhoud(url, scan, stap)
    return vraagClaude(claude, sleutels, inhoud, bron, scan, stap)
  }
  if (soort === 'screenshot') {
    const inhoud: Inhoud = (verzoek.afbeeldingen ?? []).map((b) => ({
      type: 'image', source: { type: 'base64', media_type: b.mediaType, data: b.data },
    }))
    inhoud.push({ type: 'text', text: 'Dit zijn screenshots van een recept, in volgorde; samen vormen ze één recept. Lees het uit. Staat er geen recept op, vul dan geen_recept in.' })
    return vraagClaude(claude, sleutels, inhoud, { soort, url: null, maker: null }, scan, stap)
  }
  if (soort === 'kookboek' && verzoek.afbeelding) {
    const b = verzoek.afbeelding
    return vraagClaude(claude, sleutels, [
      { type: 'image', source: { type: 'base64', media_type: b.mediaType, data: b.data } },
      { type: 'text', text: 'Lees het recept op deze foto uit. Staat er geen recept op, vul dan geen_recept in.' },
    ], { soort, url: null, maker: null }, scan, stap)
  }
  return vraagClaude(claude, sleutels, [
    { type: 'text', text: `Zet dit recept om naar gestructureerde velden:\n\n<recept>\n${verzoek.tekst ?? ''}\n</recept>` },
  ], { soort: 'tekst', url: null, maker: null }, scan, stap)
}

/** Haalt de pagina op en maakt er het bericht voor Claude van; `maker` is de naam van de site. */
async function websiteInhoud(url: string, scan: ScanUitkomst, stap: (tekst: string) => void): Promise<{ inhoud: Inhoud; bron: ConceptBron }> {
  stap('Pagina ophalen')
  const pagina = await haalWebpagina(url)
  const maker = siteNaamUit(pagina.html, pagina.eindUrl)
  const canoniek = normaliseerUrl(canoniekeUrl(pagina.html, pagina.eindUrl))
  // De canonieke link alleen als die op dezelfde site blijft; anders de link die de gebruiker gaf.
  const bronUrl = canoniek && siteNaam(canoniek) === siteNaam(url) ? canoniek : url
  const bron: ConceptBron = { soort: 'website', url: bronUrl, maker }

  const blok = leesReceptBlok(pagina.html)
  if (blok) {
    scan.route = 'website-jsonld'
    return {
      bron,
      inhoud: [{ type: 'text', text: `Hieronder een recept van de website ${maker}, zoals de site het aanlevert. Zet het om.\n\n<recept>\n${receptBlokAlsTekst(blok)}\n</recept>` }],
    }
  }
  scan.route = 'website-tekst'
  const tekst = zichtbareTekst(pagina.html)
  if (tekst.length < 200) throw new Melding('Op deze pagina staat te weinig tekst om een recept uit te lezen. Maak een screenshot van het recept en voeg die toe.')
  return {
    bron,
    inhoud: [{ type: 'text', text: `Hieronder de tekst van een webpagina van ${maker}. Haal het recept eruit en negeer de rest (menu's, reacties, reclame, andere recepten in de zijbalk). Staat er geen recept, vul dan geen_recept in.\n\n<pagina>\n${tekst}\n</pagina>` }],
  }
}

async function viaInstagram(
  claude: Anthropic, sleutels: string[], url: string, scan: ScanUitkomst, stap: (tekst: string) => void,
): Promise<Concept> {
  if (!instagramImportAan()) {
    throw new Melding('Importeren van Instagram staat nu uit. Maak een screenshot van het recept en voeg die toe.')
  }
  stap('Post ophalen bij Instagram')
  const post = await haalSocialPost(url)
  scan.kosten += SCRAPER_KOSTEN
  const bron: ConceptBron = { soort: 'instagram', url, maker: post.account }
  const onderschrift = post.onderschrift.trim()
  const kop = `Instagram-post van ${post.account ?? 'een onbekend account'}.`

  // 1. Het recept staat in het onderschrift: alleen dat, het goedkoopst.
  if (lijktRecept(onderschrift)) {
    scan.route = 'onderschrift'
    return vraagClaude(claude, sleutels, [
      { type: 'text', text: `${kop} Het recept staat in het onderschrift:\n\n<onderschrift>\n${onderschrift}\n</onderschrift>` },
    ], bron, scan, stap)
  }

  // 2. Het onderschrift verwijst naar een website: daar staat het recept.
  const link = websiteLinkIn(onderschrift)
  const linkUrl = link ? normaliseerUrl(link) : null
  if (linkUrl && !isInstagramUrl(linkUrl)) {
    try {
      const { inhoud } = await websiteInhoud(linkUrl, scan, stap)
      scan.route = `onderschrift-link ${scan.route}`
      return await vraagClaude(claude, sleutels, inhoud, bron, scan, stap)
    } catch (e) {
      console.error('instagram: link uit onderschrift', e instanceof Error ? e.message : e)
      // Door naar de video of de beelden.
    }
  }

  // 3. Video: de gesproken tekst, plus de omslag voor tekst in beeld.
  const inhoud: Inhoud = []
  const beelden = post.soort === 'video' ? post.afbeeldingen.slice(0, 1) : post.afbeeldingen.slice(0, MAX_BEELDEN)
  if (beelden.length > 0) stap(post.soort === 'carrousel' ? 'Beelden ophalen' : 'Beeld ophalen')
  for (const beeldUrl of beelden) {
    try {
      const blok = alsAfbeeldingBlok(await haalBestand(beeldUrl, MAX_BEELD_BYTES))
      if (blok) inhoud.push(blok)
    } catch (e) {
      console.error('instagram: beeld ophalen', e instanceof Error ? e.message : e)
    }
  }

  const delen = [kop]
  if (post.soort === 'video' && post.videoUrl) {
    stap('Video uitschrijven')
    const transcript = await schrijfUit(post.videoUrl)
    if (transcript) {
      scan.kosten += TRANSCRIPTIE_KOSTEN
      scan.route = 'video'
      delen.push(`Dit is de gesproken tekst uit de video, automatisch uitgeschreven:\n<transcript>\n${transcript.tekst}\n</transcript>`)
    } else {
      scan.route = 'video-zonder-transcript'
    }
    if (inhoud.length > 0) delen.push('Het beeld is de omslag van de video; soms staat daar het recept of de titel op.')
  } else {
    scan.route = post.soort === 'carrousel' ? 'carrousel' : 'foto'
    if (inhoud.length > 0) delen.push(`${inhoud.length === 1 ? 'Het beeld is' : 'De beelden zijn'} van de post, in volgorde; vaak staat het recept daarop.`)
  }
  if (onderschrift) delen.push(`Het onderschrift:\n<onderschrift>\n${onderschrift}\n</onderschrift>`)
  if (inhoud.length === 0 && delen.length === 1) {
    throw new Melding(geenRecept(post))
  }
  delen.push('Lees het recept uit. Staat er in beeld, tekst en onderschrift samen geen recept, vul dan geen_recept in.')
  inhoud.push({ type: 'text', text: delen.join('\n\n') })
  return vraagClaude(claude, sleutels, inhoud, bron, scan, stap)
}

function geenRecept(post?: SocialPost): string {
  return post?.soort === 'video'
    ? 'In deze video staat geen recept dat we kunnen uitlezen. Staat het in de reacties of op een website? Plak die link, of maak een screenshot van het recept.'
    : 'In deze post staat geen recept dat we kunnen uitlezen. Maak een screenshot van het recept en voeg die toe.'
}

/* ----------------------------------------------------------------- Claude */

/** Eén aanroep: het antwoord nagelopen als Concept, of een Melding die de gebruiker mag zien. */
async function vraagClaude(
  claude: Anthropic, sleutels: string[], inhoud: Inhoud, bron: ConceptBron, scan: ScanUitkomst, stap: (tekst: string) => void,
): Promise<Concept> {
  stap('Recept uitlezen')
  const antwoord = await claude.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: systeem(sleutels),
    messages: [{ role: 'user', content: inhoud }],
    output_config: { format: { type: 'json_schema', schema: RECEPT_SCHEMA } },
  })
  const u = antwoord.usage
  const tokensIn = u.input_tokens + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0)
  scan.tokensIn += tokensIn
  scan.tokensUit += u.output_tokens
  // Per aanroep, niet cumulatief: de Instagram-route kan Claude twee keer vragen.
  scan.kosten += claudeKosten(MODEL, tokensIn, u.output_tokens)

  if (antwoord.stop_reason === 'refusal') throw new Melding('Hier kan Pinch geen recept van maken.')
  if (antwoord.stop_reason === 'max_tokens') throw new Melding('Het recept werd te lang om uit te lezen. Probeer het met een kleiner deel.')

  const ruw = antwoord.content.find((c) => c.type === 'text')?.text ?? ''
  let data: Record<string, unknown>
  try {
    data = JSON.parse(ruw) as Record<string, unknown>
  } catch {
    throw new Melding('Het recept kwam niet goed door. Probeer het opnieuw.')
  }
  if (typeof data.geen_recept === 'string' && data.geen_recept.trim()) {
    throw new Melding(bron.soort === 'instagram' ? geenRecept({ soort: scan.route.startsWith('video') ? 'video' : 'foto' } as SocialPost)
      : bron.soort === 'website' ? 'Op deze pagina staat geen recept dat we kunnen uitlezen. Plak de link van het recept zelf, of maak een screenshot.'
      : 'Hier staat geen recept op dat we kunnen uitlezen. Probeer een duidelijkere foto van de ingrediënten en de bereiding.')
  }
  const concept = leesConcept(data, bron)
  if (!concept) throw new Melding('Het model gaf geen bruikbaar recept terug. Probeer het opnieuw.')
  return concept
}

function leesConcept(o: Record<string, unknown>, bron: ConceptBron): Concept | null {
  const titel = typeof o.titel === 'string' ? o.titel.trim() : ''
  const ingredienten = (Array.isArray(o.ingredienten) ? o.ingredienten : [])
    .flatMap((i) => {
      if (!i || typeof i !== 'object') return []
      const r = i as Record<string, unknown>
      const naam = typeof r.naam === 'string' ? r.naam.trim() : ''
      if (!naam) return []
      return [{
        hoeveelheid: typeof r.hoeveelheid === 'string' && r.hoeveelheid.trim() ? r.hoeveelheid.trim() : null,
        eenheid: typeof r.eenheid === 'string' && r.eenheid.trim() ? r.eenheid.trim() : null,
        naam,
      }]
    })
  const bereiding = (Array.isArray(o.bereiding_nl) ? o.bereiding_nl : [])
    .filter((s): s is string => typeof s === 'string' && s.trim().length > 0).map((s) => s.trim())
  if (!titel || ingredienten.length === 0) return null
  const personen = Number(o.personen)
  const minuten = Number(o.bereidingstijd_minuten)
  return {
    titel,
    personen: Number.isInteger(personen) && personen > 0 && personen <= 50 ? personen : 4,
    bereidingstijd_minuten: Number.isInteger(minuten) && minuten > 0 ? minuten : undefined,
    keuken: typeof o.keuken === 'string' && o.keuken.trim() ? o.keuken.trim() : undefined,
    tags: (Array.isArray(o.tags) ? o.tags : []).filter((t): t is string => typeof t === 'string' && t.trim().length > 0).map((t) => t.trim().toLowerCase()).slice(0, 12),
    ingredienten,
    bereiding_nl: bereiding,
    bron,
  }
}

/* --------------------------------------------------------------- database */

/**
 * De ingrediëntsleutels met een productnummer bij de winkel van deze
 * gebruiker, gesorteerd: zelfde lijst als Zelf samenstellen, en in dezelfde
 * volgorde zodat de prompt-cache raak is.
 */
async function productSleutels(sql: Sql, userId: string): Promise<string[]> {
  const [voorkeur] = await sql`select voorkeurswinkel from gebruiker_voorkeuren where user_id = ${userId}` as { voorkeurswinkel: string | null }[]
  const rijen = (voorkeur?.voorkeurswinkel === 'jumbo'
    ? await sql`select ingredient_key from jumbo_product_cache where standaard_sku is not null order by ingredient_key`
    : await sql`select ingredient_key from ah_product_cache where standaard_product_id is not null order by ingredient_key`
  ) as { ingredient_key: string }[]
  return rijen.map((r) => r.ingredient_key)
}

async function legScanVast(
  sql: Sql, userId: string, soort: Soort, url: string | null, scan: ScanUitkomst,
  status: 'gelukt' | 'mislukt', concept: Concept | null, foutTekst?: string,
): Promise<string | null> {
  try {
    const toelichting = status === 'gelukt' ? scan.route : `${scan.route}: ${(foutTekst ?? '').slice(0, 300)}`
    const [rij] = await sql`
      insert into scan (user_id, soort, url, status, telt_mee, tokens_in, tokens_uit, kosten_cent, toelichting, model)
      values (${userId}, ${soort}, ${concept?.bron?.url ?? url}, ${status}, ${status === 'gelukt'},
              ${scan.tokensIn}, ${scan.tokensUit}, ${Math.round(scan.kosten * 1000) / 1000}, ${toelichting}, ${MODEL})
      returning id
    ` as { id: string }[]
    return rij?.id ?? null
  } catch (e) {
    console.error('extraheer: scan vastleggen', e)
    return null
  }
}

/* ---------------------------------------------------------------- verzoek */

function leesBeeld(w: unknown): Beeld | null {
  if (!w || typeof w !== 'object') return null
  const o = w as Record<string, unknown>
  if (typeof o.mediaType !== 'string' || typeof o.data !== 'string' || !isAfbeeldingType(o.mediaType) || o.data.length < 100) return null
  return { mediaType: o.mediaType, data: o.data }
}

/** Loopt het verzoek na; een tekst als antwoord is de foutmelding. */
function leesVerzoek(ruw: unknown): { verzoek: Verzoek; soort: Soort; url: string | null } | string {
  if (!ruw || typeof ruw !== 'object') return 'Ongeldige aanvraag.'
  const o = ruw as Record<string, unknown>
  const stroom = o.stroom === true

  if (typeof o.url === 'string' && o.url.trim()) {
    const url = normaliseerUrl(o.url)
    if (!url) return 'Dat is geen link. Plak de link van een recept op een website of Instagram.'
    return { verzoek: { url, stroom }, soort: isInstagramUrl(url) ? 'instagram' : 'website', url }
  }
  if (Array.isArray(o.afbeeldingen)) {
    const beelden = o.afbeeldingen.map(leesBeeld).filter((b): b is Beeld => b !== null)
    if (beelden.length === 0) return 'Kies een of meer screenshots.'
    if (beelden.length > MAX_BEELDEN) return `Hooguit ${MAX_BEELDEN} screenshots per recept.`
    return { verzoek: { afbeeldingen: beelden, stroom }, soort: 'screenshot', url: null }
  }
  const foto = leesBeeld(o.afbeelding)
  if (foto) return { verzoek: { afbeelding: foto, stroom }, soort: 'kookboek', url: null }
  if (typeof o.tekst === 'string' && o.tekst.trim().length >= 20) {
    return { verzoek: { tekst: o.tekst.trim().slice(0, 20_000), stroom }, soort: 'tekst', url: null }
  }
  return 'Stuur een link, screenshots, een foto of een tekst mee.'
}

/* --------------------------------------------------------------- antwoord */

function meldingVoor(e: unknown): string {
  if (e instanceof Melding) return e.message
  if (e instanceof Anthropic.RateLimitError || (e instanceof Anthropic.APIError && Number(e.status) >= 500)) {
    return 'Het is even druk bij Claude. Probeer het over een minuut opnieuw.'
  }
  if (e instanceof Anthropic.APIError) return 'Het uitlezen is niet gelukt. Probeer het opnieuw.'
  // Fouten uit het ophalen (website, Instagram) zijn al in gewone taal geschreven.
  if (e instanceof Error && e.message && !/^(TypeError|fetch failed)/i.test(e.message)) return e.message
  return 'Het uitlezen is niet gelukt. Probeer het opnieuw.'
}

/** Eén gebeurtenis per regel, platte tekst: CapacitorHttp in de iOS-app geeft die ongemoeid door. */
function stroomAntwoord(werk: (stuur: (g: ScanGebeurtenis) => void) => Promise<void>): Response {
  const codeer = new TextEncoder()
  const stroom = new ReadableStream<Uint8Array>({
    async start(controller) {
      const stuur = (g: ScanGebeurtenis) => controller.enqueue(codeer.encode(`${JSON.stringify(g)}\n`))
      try {
        await werk(stuur)
      } finally {
        controller.close()
      }
    },
  })
  return new Response(stroom, {
    status: 200,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no' },
  })
}

function antwoord(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function fout(bericht: string, status: number, extra: Record<string, unknown> = {}): Response {
  return antwoord({ fout: bericht, ...extra }, status)
}
