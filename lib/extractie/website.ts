/**
 * Een recept van een website halen (api/extraheer.ts, websiteroute).
 *
 * Eerst het receptblok dat de meeste receptensites meegeven voor Google
 * (JSON-LD, schema.org/Recipe): schoon, compleet en goedkoop om uit te lezen.
 * Ontbreekt dat, dan de zichtbare tekst van de pagina; Claude vist het recept
 * er dan uit.
 *
 * Pure functies op HTML staan los van het ophalen, zodat ze te testen zijn.
 */

/** Hoeveel HTML we hooguit lezen; een receptpagina is zelden meer dan 1 MB. */
const MAX_HTML = 2_000_000
/** Hoeveel zichtbare tekst er naar Claude gaat als er geen receptblok is. */
const MAX_TEKST = 30_000
const TIMEOUT_MS = 12_000

export interface Webpagina {
  html: string
  /** Waar we uitkwamen, na doorverwijzingen. */
  eindUrl: string
}

/** Haalt de pagina op als een gewone browser; gooit een leesbare fout als dat niet lukt. */
export async function haalWebpagina(url: string): Promise<Webpagina> {
  const stop = new AbortController()
  const timer = setTimeout(() => stop.abort(), TIMEOUT_MS)
  try {
    const respons = await fetch(url, {
      signal: stop.signal,
      redirect: 'follow',
      headers: {
        'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
        accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'accept-language': 'nl-NL,nl;q=0.9,en;q=0.7',
      },
    })
    if (!respons.ok) {
      throw new Error(respons.status === 403 || respons.status === 429
        ? 'Deze website laat ons de pagina niet lezen. Maak een screenshot van het recept en voeg die toe.'
        : `De pagina kon niet worden opgehaald (${respons.status}).`)
    }
    const soort = respons.headers.get('content-type') ?? ''
    if (soort && !/html|xml|text\/plain/i.test(soort)) {
      throw new Error('Deze link is geen webpagina. Plak de link van het recept zelf.')
    }
    const html = (await respons.text()).slice(0, MAX_HTML)
    return { html, eindUrl: respons.url || url }
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('De website reageerde te traag. Probeer het later opnieuw of maak een screenshot.')
    }
    throw e
  } finally {
    clearTimeout(timer)
  }
}

/* ------------------------------------------------------------------ JSON-LD */

export interface ReceptBlok {
  naam: string | null
  ingredienten: string[]
  stappen: string[]
  porties: string | null
  minuten: number | null
  keuken: string | null
  trefwoorden: string[]
  auteur: string | null
}

type Json = Record<string, unknown>

/**
 * Het schema.org/Recipe-blok uit de pagina, of null als het er niet is. Kijkt
 * in alle <script type="application/ld+json">-blokken, ook in @graph en in
 * lijsten; het eerste blok met ingrediënten wint.
 */
export function leesReceptBlok(html: string): ReceptBlok | null {
  const blokken = [...html.matchAll(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
  for (const [, ruw] of blokken) {
    let data: unknown
    try {
      data = JSON.parse(ruw.trim())
    } catch {
      // Sommige sites laten HTML-commentaar of een afsluitende komma staan.
      try { data = JSON.parse(ruw.replace(/<!--[\s\S]*?-->/g, '').replace(/,\s*([}\]])/g, '$1').trim()) } catch { continue }
    }
    const recept = zoekRecept(data)
    if (recept) {
      const blok = alsReceptBlok(recept)
      if (blok.ingredienten.length > 0) return blok
    }
  }
  return null
}

function isRecipe(o: Json): boolean {
  const type = o['@type']
  const types = Array.isArray(type) ? type : [type]
  return types.some((t) => typeof t === 'string' && t.toLowerCase() === 'recipe')
}

function zoekRecept(data: unknown, diepte = 0): Json | null {
  if (!data || typeof data !== 'object' || diepte > 4) return null
  if (Array.isArray(data)) {
    for (const item of data) {
      const r = zoekRecept(item, diepte + 1)
      if (r) return r
    }
    return null
  }
  const o = data as Json
  if (isRecipe(o)) return o
  for (const sleutel of ['@graph', 'mainEntity', 'mainEntityOfPage', 'itemListElement']) {
    const r = zoekRecept(o[sleutel], diepte + 1)
    if (r) return r
  }
  return null
}

function alsTekst(w: unknown): string | null {
  if (typeof w === 'string') return ontHtml(w).trim() || null
  if (typeof w === 'number') return String(w)
  if (Array.isArray(w)) return w.map(alsTekst).filter(Boolean).join(', ') || null
  if (w && typeof w === 'object') {
    const o = w as Json
    return alsTekst(o.name ?? o.text ?? o['@value'])
  }
  return null
}

function alsLijst(w: unknown): string[] {
  if (typeof w === 'string') return w.split(/\r?\n|,(?=\s*[A-Z])/).map((s) => ontHtml(s).trim()).filter(Boolean)
  if (!Array.isArray(w)) return w ? [alsTekst(w) ?? ''].filter(Boolean) : []
  return w.map(alsTekst).filter((s): s is string => Boolean(s))
}

/** HowToStep, HowToSection (met itemListElement) of platte tekst; alles plat naar stappen. */
function alsStappen(w: unknown): string[] {
  if (typeof w === 'string') {
    return ontHtml(w).split(/\r?\n+/).map((s) => s.trim()).filter(Boolean)
  }
  if (!Array.isArray(w)) return w && typeof w === 'object' ? alsStappen([(w as Json)]) : []
  const uit: string[] = []
  for (const item of w) {
    if (typeof item === 'string') { uit.push(...alsStappen(item)); continue }
    if (!item || typeof item !== 'object') continue
    const o = item as Json
    if (Array.isArray(o.itemListElement)) uit.push(...alsStappen(o.itemListElement))
    else {
      const t = alsTekst(o.text ?? o.name)
      if (t) uit.push(t)
    }
  }
  return uit
}

/** ISO 8601-duur (PT1H30M) naar minuten; null als het niet te lezen is. */
export function duurInMinuten(w: unknown): number | null {
  if (typeof w !== 'string') return null
  const m = w.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i)
  if (!m || (!m[1] && !m[2] && !m[3])) return null
  const minuten = Number(m[1] ?? 0) * 1440 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0)
  return minuten > 0 ? minuten : null
}

function alsReceptBlok(r: Json): ReceptBlok {
  const totaal = duurInMinuten(r.totalTime)
  const som = (duurInMinuten(r.prepTime) ?? 0) + (duurInMinuten(r.cookTime) ?? 0)
  return {
    naam: alsTekst(r.name),
    ingredienten: alsLijst(r.recipeIngredient ?? r.ingredients),
    stappen: alsStappen(r.recipeInstructions),
    porties: alsTekst(r.recipeYield),
    minuten: totaal ?? (som > 0 ? som : null),
    keuken: alsTekst(r.recipeCuisine),
    trefwoorden: alsLijst(r.keywords).concat(alsLijst(r.recipeCategory)),
    auteur: alsTekst(r.author),
  }
}

/** Het receptblok als tekst voor Claude: alles wat er stond, niets erbij. */
export function receptBlokAlsTekst(b: ReceptBlok): string {
  const regels = [
    b.naam ? `Titel: ${b.naam}` : null,
    b.porties ? `Porties: ${b.porties}` : null,
    b.minuten ? `Totale tijd: ${b.minuten} minuten` : null,
    b.keuken ? `Keuken: ${b.keuken}` : null,
    b.trefwoorden.length > 0 ? `Trefwoorden: ${b.trefwoorden.slice(0, 12).join(', ')}` : null,
    '',
    'Ingrediënten:',
    ...b.ingredienten.map((i) => `- ${i}`),
    '',
    'Bereiding:',
    ...b.stappen.map((s, n) => `${n + 1}. ${s}`),
  ]
  return regels.filter((r) => r !== null).join('\n')
}

/* ------------------------------------------------------------ zichtbare tekst */

const ENTITEITEN: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', eacute: 'é', egrave: 'è', euml: 'ë',
  iuml: 'ï', ouml: 'ö', uuml: 'ü', agrave: 'à', aacute: 'á', ccedil: 'ç', deg: '°', frac12: '½',
  frac14: '¼', frac34: '¾', ndash: '–', mdash: '—', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“',
}

/** HTML-entiteiten en tags weg; alleen tekst over. */
export function ontHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(Number.parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z0-9]+);/gi, (heel, naam: string) => ENTITEITEN[naam.toLowerCase()] ?? heel)
    .replace(/[ \t ]+/g, ' ')
}

/**
 * De tekst die een lezer op de pagina ziet: zonder scripts, stijlen,
 * navigatie en voettekst, met een regeleinde per blok. Afgekapt op MAX_TEKST
 * tekens: het recept staat vrijwel altijd in het eerste deel.
 */
export function zichtbareTekst(html: string): string {
  const zonder = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|noscript|svg|template|iframe|nav|footer|header|form|button)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article|\/td)\b[^>]*>/gi, '\n')
  return ontHtml(zonder)
    .split('\n').map((r) => r.trim()).filter(Boolean).join('\n')
    .slice(0, MAX_TEKST)
}

/** De naam van de site (og:site_name), anders de hostnaam zonder www. */
export function siteNaamUit(html: string, url: string): string {
  const og = html.match(/<meta[^>]+property\s*=\s*["']og:site_name["'][^>]+content\s*=\s*["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]+content\s*=\s*["']([^"']+)["'][^>]+property\s*=\s*["']og:site_name["']/i)
  if (og) return ontHtml(og[1]).trim()
  try { return new URL(url).hostname.replace(/^www\./i, '') } catch { return url }
}

/** De canonieke link van de pagina (og:url of <link rel=canonical>), anders de opgegeven. */
export function canoniekeUrl(html: string, url: string): string {
  const m = html.match(/<link[^>]+rel\s*=\s*["']canonical["'][^>]+href\s*=\s*["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]+property\s*=\s*["']og:url["'][^>]+content\s*=\s*["']([^"']+)["']/i)
  if (!m) return url
  try { return new URL(m[1], url).href } catch { return url }
}
