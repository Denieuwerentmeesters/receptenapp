/**
 * Leest het antwoord van Claude mee terwijl het binnenkomt.
 *
 * Het antwoord is één JSON-object ({ keuken, begrepen, gerechten: [...], … })
 * dat in stukjes aankomt. Wachten tot het af is betekent een halve minuut naar
 * een spinner kijken; hier halen we elk gerecht eruit zodra zijn accolade
 * sluit, zodat de app ze één voor één kan tonen.
 *
 * Geen volledige JSON-parser: we tellen alleen diepte en letten op tekst
 * tussen aanhalingstekens. Het uitlezen zelf doet JSON.parse op het stuk dat
 * af is. Het hele antwoord wordt aan het eind nog één keer gewoon geparsed
 * (api/samenstellen.ts); dit is alleen voor het tussentijdse beeld.
 */

export type StroomDeel =
  | { soort: 'kop'; waarde: Record<string, unknown> }
  | { soort: 'gerecht'; waarde: unknown }

export class MenuStroom {
  private buffer = ''
  private plek = 0
  private diepte = 0
  private inTekst = false
  private ontsnapt = false
  /** Begin van de tekst waar we nu in zitten, en van de laatste die af is op diepte 1. */
  private tekstStart = -1
  private laatsteSleutel = ''
  private laatsteSleutelStart = -1
  /** Diepte van de lijst met gerechten zodra die open is; -1 daarvoor en erna. */
  private lijstDiepte = -1
  private gerechtStart = -1

  /** Geeft terug wat er met dit stuk tekst áf is gekomen. */
  voeg(stuk: string): StroomDeel[] {
    this.buffer += stuk
    const uit: StroomDeel[] = []

    for (; this.plek < this.buffer.length; this.plek++) {
      const teken = this.buffer[this.plek]

      if (this.inTekst) {
        if (this.ontsnapt) this.ontsnapt = false
        else if (teken === '\\') this.ontsnapt = true
        else if (teken === '"') {
          this.inTekst = false
          if (this.diepte === 1) {
            this.laatsteSleutel = this.buffer.slice(this.tekstStart + 1, this.plek)
            this.laatsteSleutelStart = this.tekstStart
          }
        }
        continue
      }

      if (teken === '"') {
        this.inTekst = true
        this.tekstStart = this.plek
      } else if (teken === '{' || teken === '[') {
        if (teken === '[' && this.diepte === 1 && this.laatsteSleutel === 'gerechten' && this.lijstDiepte < 0) {
          this.lijstDiepte = 2
          const kop = this.leesKop()
          if (kop) uit.push({ soort: 'kop', waarde: kop })
        } else if (teken === '{' && this.diepte === this.lijstDiepte) {
          this.gerechtStart = this.plek
        }
        this.diepte++
      } else if (teken === '}' || teken === ']') {
        this.diepte--
        if (teken === '}' && this.diepte === this.lijstDiepte && this.gerechtStart >= 0) {
          try {
            uit.push({ soort: 'gerecht', waarde: JSON.parse(this.buffer.slice(this.gerechtStart, this.plek + 1)) })
          } catch { /* het eindantwoord beslist; hier slaan we 'm over */ }
          this.gerechtStart = -1
        } else if (teken === ']' && this.diepte === 1 && this.lijstDiepte === 2) {
          // De lijst is dicht: een latere lijst (draaiboek) is geen gerecht.
          this.lijstDiepte = -2
        }
      }
    }
    return uit
  }

  /** Alles wat er binnenkwam, voor het eindantwoord. */
  get alles(): string {
    return this.buffer
  }

  /** De velden vóór "gerechten" (keuken, begrepen), als die samen geldige JSON zijn. */
  private leesKop(): Record<string, unknown> | null {
    const voor = this.buffer.slice(0, this.laatsteSleutelStart).replace(/[\s,]+$/, '')
    try {
      const kop = JSON.parse(`${voor}}`) as unknown
      return kop && typeof kop === 'object' ? kop as Record<string, unknown> : null
    } catch {
      return null
    }
  }
}
