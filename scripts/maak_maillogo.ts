/**
 * Maakt het logo voor de mails van Kookmaatje: app/public/mail/kookmaatje.png.
 * Mailprogramma's (Gmail voorop) tonen geen SVG, dus het woordmerk wordt een
 * PNG, doorzichtig, voor op het rode kopvlak van de mail. Draai opnieuw als
 * het woordmerk verandert: `npx tsx scripts/maak_maillogo.ts`.
 */
import sharp from 'sharp'
import { VLAK, woordmerkSvg } from '../app/src/ds/woordmerk'

const [x, y, b, h] = VLAK
const breedte = 520
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${b} ${h}" width="${breedte}" height="${Math.round(breedte * h / b)}">${woordmerkSvg('#FFF000', '#FFFFFF')}</svg>`
await sharp(Buffer.from(svg), { density: 300 }).png().toFile('app/public/mail/kookmaatje.png')
console.log('klaar')
