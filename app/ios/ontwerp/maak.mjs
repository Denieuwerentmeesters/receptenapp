// Tekent het app-icoon en het opstartscherm uit één SVG.
// Draaien vanuit de root: node app/ios/ontwerp/maak.mjs
import sharp from 'sharp'

const ROOD = '#AB2328', FEL = '#E8202E', CREME = '#FFF6E8', WIT = '#FFFFFF', GEEL = '#FFF000'
const ASSETS = new URL('../App/App/Assets.xcassets/', import.meta.url).pathname

// Het logo van Pinch; dezelfde tekening als src/ds/Logo.tsx en public/favicon.svg.

/** Het beeldmerk: de p met de zoutkorrel, getekend in een vlak van 120. */
const beeldmerk = `
  <g fill="none" stroke="${WIT}" stroke-width="20">
    <path d="M34 28V106"/>
    <circle cx="62" cy="56" r="19"/>
  </g>
  <rect x="82" y="8" width="18" height="18" rx="3.5" transform="rotate(20 91 17)" fill="${GEEL}"/>`

/** Het woordmerk "pinch", getekend in een vlak van 240 bij 104 (vanaf -4, -16). Nu nergens meer in gebruik (het opstartscherm is alleen rood), maar bewaard als referentie. */
const _woordmerk = `
  <g fill="none" stroke="${CREME}" stroke-width="16">
    <path d="M8 16V84"/>
    <circle cx="32" cy="40" r="16"/>
    <path d="M70 16V64"/>
    <path d="M92 64V38A16 16 0 0 1 124 38V64"/>
    <path d="M173.3 28.7A16 16 0 1 0 173.3 51.3"/>
    <path d="M192 -6V64"/>
    <path d="M192 64V38A16 16 0 0 1 224 38V64"/>
  </g>
  <rect x="62" y="-7" width="16" height="16" rx="3" transform="rotate(20 70 1)" fill="${GEEL}"/>`

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
await sharp(svg(1024, FEL, beeldmerk, [0, 0, 120, 120], 0.78)).flatten({ background: FEL }).png()
  .toFile(`${ASSETS}AppIcon.appiconset/AppIcon-512@2x.png`)

// Opstartscherm: alleen rood, zonder woordmerk. Het eerste logo dat je ziet
// is de laadanimatie in de app (components/Laadanimatie.tsx); met een stil
// logo ervoor leek het alsof de app eerst bevroor en dan pas ging bewegen.
// iOS snijdt het vierkant bij tot het scherm.
const splash = await sharp(svg(2732, ROOD, '', [0, 0, 1, 1], 1)).flatten({ background: ROOD }).png().toBuffer()
for (const naam of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
  await sharp(splash).toFile(`${ASSETS}Splash.imageset/${naam}`)
}
