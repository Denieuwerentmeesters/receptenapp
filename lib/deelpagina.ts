/**
 * De openbare receptpagina (/r/<id>) als HTML. Buiten de app-bundle, dus
 * zonder het design system: dezelfde kleuren, systeemlettertype, geen
 * JavaScript. Het aantal personen wissel je met gewone links (?p=…).
 */

import { schaalIngredienten } from '../app/src/lib/schaal'
import type { Ingredient } from '../app/src/lib/database.types'

export interface DeelRecept {
  id: string
  titel: string
  titel_nl: string | null
  personen: number
  bereidingstijd_minuten: number | null
  keuken: string | null
  ingredienten: Ingredient[]
  bereiding_nl: string[]
  afbeelding_url: string | null
  /** Uit de gedeelde pool: dan kan de ontvanger het in de app openen. */
  inPool: boolean
}

export const MAX_PERSONEN = 12

function esc(tekst: string): string {
  return tekst
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

const STIJL = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
body {
  margin: 0; background: #FFF6E8; color: #141414;
  font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif;
  font-size: 16px; line-height: 1.5; -webkit-text-size-adjust: 100%;
}
.blad { max-width: 640px; margin: 0 auto; background: #FFF6E8; }
.kop { position: relative; min-height: 340px; height: min(60vh, 520px); background: #E8202E center/cover; color: #fff; }
.kop::after {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(to bottom, rgba(0,0,0,.4) 0%, rgba(0,0,0,0) 24%, rgba(0,0,0,0) 42%, rgba(0,0,0,.78) 100%);
}
.merk {
  position: absolute; z-index: 1; top: calc(16px + env(safe-area-inset-top)); left: 20px;
  font-weight: 800; font-size: 15px; letter-spacing: .12em; text-transform: uppercase;
  color: #FFF000; text-decoration: none;
}
.titel { position: absolute; z-index: 1; left: 22px; right: 22px; bottom: 22px; }
.label { font-size: 12px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
h1 { margin: 8px 0 0; font-size: 30px; line-height: 1.1; text-transform: uppercase; text-shadow: 0 2px 12px rgba(0,0,0,.35); overflow-wrap: anywhere; }
.feiten { display: flex; flex-wrap: wrap; gap: 4px 16px; margin-top: 12px; font-size: 13px; font-weight: 700; }
main { padding: 20px 22px 8px; }
.rij { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
h2 { margin: 0; font-size: 12px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: rgba(20,20,20,.6); }
.personen { display: flex; align-items: center; gap: 10px; font-size: 15px; font-weight: 700; }
.personen span { min-width: 64px; text-align: center; }
.rond {
  display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px;
  border-radius: 999px; font-size: 20px; font-weight: 700; line-height: 1; text-decoration: none;
}
.min { color: #141414; border: 1.5px solid rgba(20,20,20,.2); }
.plus { color: #FFF6E8; background: #AB2328; }
.uit { opacity: .3; pointer-events: none; }
ul, ol { list-style: none; margin: 8px 0 0; padding: 0; }
.ingredienten li { display: flex; align-items: baseline; gap: 12px; padding: 11px 2px; border-bottom: 1.5px solid rgba(20,20,20,.12); font-size: 15px; }
.ingredienten b { flex: none; width: 88px; font-size: 14px; color: #E8202E; }
.stappen { margin-top: 4px; }
.stappen li { display: flex; gap: 12px; padding: 10px 0; font-size: 15px; }
.stappen i {
  flex: none; width: 28px; height: 28px; border-radius: 999px; background: #141414; color: #FFF000;
  display: flex; align-items: center; justify-content: center; font-style: normal; font-size: 13px; font-weight: 700;
}
.stappen h2, main > h2 { margin-top: 26px; }
footer { margin: 28px 22px 0; padding: 22px 0 calc(32px + env(safe-area-inset-bottom)); border-top: 1.5px solid rgba(20,20,20,.12); }
footer p { margin: 0 0 14px; font-size: 14px; color: rgba(20,20,20,.7); }
.knop {
  display: block; padding: 16px 20px; border-radius: 999px; background: #AB2328; color: #FFF6E8;
  text-align: center; font-weight: 700; text-decoration: none;
}
.leeg { padding: 72px 24px; text-align: center; }
.leeg h1 { color: #AB2328; text-shadow: none; font-size: 24px; }
.leeg p { margin: 12px 0 24px; }
@media print {
  .kop { height: auto; min-height: 0; background: none !important; color: #141414; }
  .kop::after, .merk, .personen a, footer { display: none; }
  .titel { position: static; padding: 0 22px; }
  h1 { text-shadow: none; }
}
`

function pagina(kop: string, inhoud: string): string {
  return `<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#141414">
<link rel="icon" href="/favicon.svg">
${kop}
<style>${STIJL}</style>
</head>
<body>
${inhoud}
</body>
</html>`
}

/** De pagina voor één recept, geschaald naar `personen`. `adres` is de volledige link zonder ?p. */
export function receptPagina(recept: DeelRecept, personen: number, adres: string): string {
  const titel = recept.titel_nl ?? recept.titel
  const ingredienten = schaalIngredienten(recept.ingredienten, recept.personen, personen)
  const tijd = recept.bereidingstijd_minuten
  const omschrijving = [
    recept.keuken,
    tijd ? `${tijd} min` : null,
    `${recept.ingredienten.length} ingrediënten`,
  ].filter(Boolean).join(' · ')
  const pad = new URL(adres).pathname
  const foto = recept.afbeelding_url

  const kop = `<title>${esc(titel)} · Pinch</title>
<meta name="description" content="${esc(omschrijving)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Pinch">
<meta property="og:title" content="${esc(titel)}">
<meta property="og:description" content="${esc(omschrijving)}">
<meta property="og:url" content="${esc(adres)}">
${foto ? `<meta property="og:image" content="${esc(foto)}">\n<meta name="twitter:card" content="summary_large_image">` : ''}`

  const inhoud = `<div class="blad">
<header class="kop"${foto ? ` style="background-image:url('${esc(encodeURI(foto))}')"` : ''}>
  <a class="merk" href="/">Pinch</a>
  <div class="titel">
    <div class="label">${esc(recept.keuken ?? 'Recept')}</div>
    <h1>${esc(titel)}</h1>
    <div class="feiten">
      ${tijd ? `<span>${tijd} min</span>` : ''}
      <span>${personen} ${personen === 1 ? 'persoon' : 'personen'}</span>
      <span>${recept.ingredienten.length} ingrediënten</span>
    </div>
  </div>
</header>
<main>
  <div class="rij" id="ingredienten">
    <h2>Ingrediënten</h2>
    <div class="personen">
      <a class="rond min${personen <= 1 ? ' uit' : ''}" href="${pad}?p=${Math.max(1, personen - 1)}#ingredienten" aria-label="Minder personen">&minus;</a>
      <span>${personen} pers.</span>
      <a class="rond plus${personen >= MAX_PERSONEN ? ' uit' : ''}" href="${pad}?p=${Math.min(MAX_PERSONEN, personen + 1)}#ingredienten" aria-label="Meer personen">+</a>
    </div>
  </div>
  <ul class="ingredienten">
    ${ingredienten.map((i) => `<li><b>${esc(i.weergave)}</b><span>${esc(i.naam)}</span></li>`).join('\n    ')}
  </ul>
  <h2>Zo maak je het</h2>
  <ol class="stappen">
    ${recept.bereiding_nl.map((stap, i) => `<li><i>${i + 1}</i><span>${esc(stap)}</span></li>`).join('\n    ')}
  </ol>
</main>
<footer>
  <p>Gedeeld vanuit Pinch: je weekmenu, je recepten en je boodschappen in één keer in je mandje.</p>
  <a class="knop" href="${recept.inPool ? `/#/recept/${esc(recept.id)}` : '/'}">${recept.inPool ? 'Open in Pinch' : 'Bekijk Pinch'}</a>
</footer>
</div>`

  return pagina(kop, inhoud)
}

/** Als de link niet (meer) klopt, of er iets misging. */
export function meldingPagina(kop: string, tekst: string): string {
  return pagina(
    `<title>${esc(kop)} · Pinch</title>`,
    `<div class="blad leeg">
<h1>${esc(kop)}</h1>
<p>${esc(tekst)}</p>
<a class="knop" href="/">Naar Pinch</a>
</div>`,
  )
}
