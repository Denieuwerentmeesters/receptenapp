// Tekent het Android-icoon en het opstartscherm: dezelfde K als op iOS
// (app/ios/ontwerp/maak.mjs), wit op paars.
// Draaien vanuit de root: node app/android/ontwerp/maak.mjs
import sharp from 'sharp'
import { LETTERS } from '../../src/ds/woordmerk.ts'

const PAARS = '#5E1A3B', WIT = '#FFFFFF'
const RES = new URL('../app/src/main/res/', import.meta.url).pathname
const K = `<path d="${LETTERS[0].d}" fill="${WIT}"/>`
const KBOX = [-9.8, -95.5, 116, 116] // x0, y0, breed, hoog

/** De K in het midden van een vierkant van `maat`, op `schaal` van de breedte; `kleur` null = doorzichtig. */
const tekening = (maat, kleur, schaal, vorm = 'vierkant') => {
  const [x0, y0, breed, hoog] = KBOX
  const s = (maat * schaal) / breed
  const achter = kleur
    ? vorm === 'rond'
      ? `<circle cx="${maat / 2}" cy="${maat / 2}" r="${maat / 2}" fill="${kleur}"/>`
      : vorm === 'afgerond'
        ? `<rect width="100%" height="100%" rx="${maat * 0.18}" fill="${kleur}"/>`
        : `<rect width="100%" height="100%" fill="${kleur}"/>`
    : ''
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${maat}" height="${maat}">${achter}
    <g transform="translate(${(maat - breed * s) / 2 - x0 * s} ${(maat - hoog * s) / 2 - y0 * s}) scale(${s})">${K}</g></svg>`)
}
const png = (buf, bestand) => sharp(buf).png().toFile(bestand)

// mdpi = 1×; het adaptieve icoon is 108 dp, het oude icoon 48 dp.
const DICHTHEID = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }
for (const [naam, f] of Object.entries(DICHTHEID)) {
  const map = `${RES}mipmap-${naam}/`
  // Voorgrond: de K binnen de veilige zone (66 van 108 dp), doorzichtig.
  await png(tekening(Math.round(108 * f), null, 0.4), `${map}ic_launcher_foreground.png`)
  // Oude iconen (vóór Android 8): vierkant met afgeronde hoeken, en rond.
  await png(tekening(Math.round(48 * f), PAARS, 0.62, 'afgerond'), `${map}ic_launcher.png`)
  await png(tekening(Math.round(48 * f), PAARS, 0.56, 'rond'), `${map}ic_launcher_round.png`)
}

// Opstartscherm: alleen paars, zoals op iOS (de laadanimatie in de app is het eerste logo).
const effen = (b, h) => sharp({ create: { width: b, height: h, channels: 3, background: PAARS } }).png()
await effen(480, 320).toFile(`${RES}drawable/splash.png`)
for (const naam of ['hdpi', 'mdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
  const f = DICHTHEID[naam]
  await effen(Math.round(320 * f), Math.round(480 * f)).toFile(`${RES}drawable-port-${naam}/splash.png`)
  await effen(Math.round(480 * f), Math.round(320 * f)).toFile(`${RES}drawable-land-${naam}/splash.png`)
}

// Google Play-icoon: 512 × 512, zonder doorzichtigheid (Google rondt zelf af).
const winkel = new URL('../play/', import.meta.url).pathname
await import('node:fs').then(fs => fs.mkdirSync(winkel, { recursive: true }))
await sharp(tekening(512, PAARS, 0.6)).flatten({ background: PAARS }).png().toFile(`${winkel}icoon-512.png`)
