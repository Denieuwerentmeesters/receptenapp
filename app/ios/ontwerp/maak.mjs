// Tekent het app-icoon en het opstartscherm uit één SVG.
// Draaien vanuit de root: node app/ios/ontwerp/maak.mjs
import sharp from 'sharp'
import { LETTERS, woordmerkSvg } from '../../src/ds/woordmerk.ts'

const ROOD = '#5E1A3B', FEL = '#5E1A3B', CREME = '#F8F1EC', WIT = '#FFFFFF', GEEL = '#FFF000'
const ASSETS = new URL('../App/App/Assets.xcassets/', import.meta.url).pathname

// Het logo van Kookmaatje; dezelfde tekening als src/ds/Logo.tsx (uit src/ds/woordmerk.ts).

/** Het beeldmerk: alleen de K van het woordmerk, zonder korrel (x 6–90, y -75–0). Net als public/favicon.svg. */
const K = LETTERS[0]
const beeldmerk = `<path d="${K.d}" fill="${WIT}"/>`

/** Het hele woordmerk, voor wie het nodig heeft (nu nergens in gebruik: het opstartscherm is alleen rood). */
const _woordmerk = woordmerkSvg(CREME, GEEL)

/** Een vierkant van `maat` in `kleur`, met de tekening (`breed` bij `hoog`, vanaf x0, y0) in het midden op `schaal` van de breedte. */
const svg = (maat, kleur, tekening, [x0, y0, breed, hoog], schaal) => {
  const s = (maat * schaal) / breed
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${maat}" height="${maat}">
      <rect width="100%" height="100%" fill="${kleur}"/>
      <g transform="translate(${(maat - breed * s) / 2 - x0 * s} ${(maat - hoog * s) / 2 - y0 * s}) scale(${s})">${tekening}</g>
    </svg>`)
}

// Icoon: zonder doorzichtigheid, anders weigert App Store Connect 'm.
await sharp(svg(1024, FEL, beeldmerk, [-9.8, -95.5, 116, 116], 0.72)).flatten({ background: FEL }).png()
  .toFile(`${ASSETS}AppIcon.appiconset/AppIcon-512@2x.png`)

// Opstartscherm: alleen rood, zonder woordmerk. Het eerste logo dat je ziet
// is de laadanimatie in de app (components/Laadanimatie.tsx); met een stil
// logo ervoor leek het alsof de app eerst bevroor en dan pas ging bewegen.
// iOS snijdt het vierkant bij tot het scherm.
const splash = await sharp(svg(2732, ROOD, '', [0, 0, 1, 1], 1)).flatten({ background: ROOD }).png().toBuffer()
for (const naam of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
  await sharp(splash).toFile(`${ASSETS}Splash.imageset/${naam}`)
}
