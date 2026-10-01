// Tekent het app-icoon en het opstartscherm uit één SVG.
// Draaien vanuit de root: node app/ios/ontwerp/maak.mjs
import sharp from 'sharp'

const ROOD = '#AB2328', CREME = '#FFF6E8', GEEL = '#FFF000'
const ASSETS = new URL('../App/App/Assets.xcassets/', import.meta.url).pathname

/** Een pan met drie sliertjes stoom, getekend in een vlak van 1024. */
const pan = `
  <g fill="none" stroke="${GEEL}" stroke-width="44" stroke-linecap="round">
    <path d="M372 150c-44 44 44 88 0 132s44 88 0 132"/>
    <path d="M512 110c-44 48 44 96 0 144s44 96 0 144"/>
    <path d="M652 150c-44 44 44 88 0 132s44 88 0 132"/>
  </g>
  <g fill="${CREME}">
    <rect x="212" y="482" width="600" height="64" rx="32"/>
    <path d="M252 590h520v130c0 88-72 160-160 160H412c-88 0-160-72-160-160z"/>
    <rect x="128" y="610" width="150" height="72" rx="36"/>
    <rect x="746" y="610" width="150" height="72" rx="36"/>
  </g>`

const svg = (maat, schaal) => {
  const s = (maat * schaal) / 1024, weg = (maat - maat * schaal) / 2
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${maat}" height="${maat}">
      <rect width="100%" height="100%" fill="${ROOD}"/>
      <g transform="translate(${weg} ${weg}) scale(${s})">${pan}</g>
    </svg>`)
}

// Icoon: zonder doorzichtigheid, anders weigert App Store Connect 'm.
await sharp(svg(1024, 0.78)).flatten({ background: ROOD }).png()
  .toFile(`${ASSETS}AppIcon.appiconset/AppIcon-512@2x.png`)

// Opstartscherm: iOS snijdt het vierkant bij tot het scherm, dus de pan klein in het midden.
const splash = await sharp(svg(2732, 0.2)).flatten({ background: ROOD }).png().toBuffer()
for (const naam of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
  await sharp(splash).toFile(`${ASSETS}Splash.imageset/${naam}`)
}
