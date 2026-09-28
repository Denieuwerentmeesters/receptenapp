import type { BoodschapItem } from './database.types'
import { LOOPROUTE, schapVoor, type Schap } from './winkelindeling'

/**
 * Eén regel op het scherm. In de database staat een rij per ingrediënt per
 * recept; hier voegen we ze samen op ingredient_key, zodat twee recepten met
 * tomaten één regel "tomaten" opleveren.
 */
export interface LijstRegel {
  key: string
  naam: string
  /** De databaserijen achter deze regel — afvinken en verwijderen raakt ze allemaal. */
  items: BoodschapItem[]
  ids: string[]
  afgevinkt: boolean
  label: string
  /** Eén representatieve rij, voor de AH-koppeling (zoekProduct, bouwMandjeLink). */
  voorbeeld: BoodschapItem
}

export interface LijstGroep {
  schap: Schap
  regels: LijstRegel[]
}

export function voegSamen(items: BoodschapItem[]): LijstRegel[] {
  const perKey = new Map<string, BoodschapItem[]>()
  for (const item of items) {
    const rij = perKey.get(item.ingredient_key) ?? []
    rij.push(item)
    perKey.set(item.ingredient_key, rij)
  }

  return [...perKey].map(([key, rij]) => ({
    key,
    naam: rij[0].naam,
    items: rij,
    ids: rij.map((i) => i.id),
    // Pas afgevinkt als álles erachter afgevinkt is. Komt er een recept bij
    // met hetzelfde ingrediënt, dan staat de regel weer open.
    afgevinkt: rij.every((i) => i.is_afgevinkt),
    label: labelVan(rij),
    voorbeeld: rij[0],
  }))
}

/**
 * Optellen kan alleen bij dezelfde eenheid. Verschillen ze ("200 g" en
 * "1 blik"), dan tonen we ze naast elkaar in plaats van er een te laten vallen.
 */
function labelVan(rij: BoodschapItem[]): string {
  const perEenheid = new Map<string, number | null>()
  for (const item of rij) {
    const eenheid = (item.eenheid ?? '').trim()
    const huidig = perEenheid.get(eenheid)
    if (item.hoeveelheid === null) {
      if (!perEenheid.has(eenheid)) perEenheid.set(eenheid, null)
      continue
    }
    perEenheid.set(eenheid, (huidig ?? 0) + item.hoeveelheid)
  }

  const delen = [...perEenheid]
    .filter(([, waarde]) => waarde !== null)
    .map(([eenheid, waarde]) => `${formatteer(waarde as number)} ${eenheid}`.trim())
  const naam = rij[0].naam.toLowerCase()
  return delen.length > 0 ? `${delen.join(' + ')} ${naam}` : naam
}

function formatteer(waarde: number): string {
  const afgerond = waarde >= 10 ? Math.round(waarde) : Math.round(waarde * 10) / 10
  return String(afgerond).replace('.', ',')
}

/**
 * Groepeert op schap, in de looproute door de winkel. Binnen een schap zakken
 * afgevinkte regels naar onderen, zodat je bovenaan ziet wat je nog moet halen.
 */
export function groepeerOpSchap(regels: LijstRegel[]): LijstGroep[] {
  const perSchap = new Map<Schap, LijstRegel[]>()
  for (const regel of regels) {
    const schap = schapVoor(regel.key)
    const rij = perSchap.get(schap) ?? []
    rij.push(regel)
    perSchap.set(schap, rij)
  }
  return LOOPROUTE
    .filter((schap) => perSchap.has(schap))
    .map((schap) => ({
      schap,
      regels: [...perSchap.get(schap)!].sort((a, b) =>
        Number(a.afgevinkt) - Number(b.afgevinkt) || a.naam.localeCompare(b.naam, 'nl')),
    }))
}
