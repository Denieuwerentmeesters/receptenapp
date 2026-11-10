/**
 * Loopt alle recepten na op het verband tussen de bereiding en de ingrediënten:
 *
 *  - "ongenoemd": een ingrediënt dat in geen enkele stap voorkomt;
 *  - "ontbreekt": een stap noemt een product (een woord dat elders als
 *    ingrediënt voorkomt) dat in dit recept niet in de lijst staat.
 *
 * Gebruikt dezelfde woordvergelijking als de kookmodus
 * (app/src/lib/stapIngredienten.ts).
 *
 *   npm run stapaudit -- [--bron data/recepten.json] [--uit rapport.json]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { noemtIngredient, productWoorden, stam, woorden, zelfdeWoord, zoekWoorden } from '../app/src/lib/stapIngredienten'

interface Ing { hoeveelheid: string | null; eenheid: string | null; naam: string }
interface Recept { titel: string; titel_nl?: string; ingredienten: Ing[]; bereiding_nl: string[] }

const arg = (naam: string, standaard: string) => {
  const i = process.argv.indexOf(`--${naam}`)
  return i >= 0 ? process.argv[i + 1] : standaard
}
const recepten: Recept[] = JSON.parse(readFileSync(arg('bron', 'data/recepten.json'), 'utf8'))

// Woorden die wel in een ingrediëntnaam staan maar in stappen iets anders betekenen.
const NIET_ALS_PRODUCT = new Set([
  'zout', 'peper', 'water', 'olie', 'pasta', 'saus', 'soep', 'kruiden', 'mix', 'blokjes', 'plakjes', 'stukjes', 'smaak', 'vel',
  'bak', 'bakken', 'kruid', 'serveren', 'sla', 'beleg', 'korst', 'blik', 'keuze', 'pot', 'vingers', 'julienne', 'toast', 'keukenmachine', 'gehakte', 'dressing', 'topping', 'poeder', 'vlokken', 'blad', 'bladeren', 'zaad', 'zaden', 'stengel', 'pit', 'schil', 'sap',
])

// Productwoorden uit alle recepten: komt in minstens vijf recepten voor.
const telling = new Map<string, Set<number>>()
recepten.forEach((r, i) => {
  for (const ing of r.ingredienten) for (const w of zoekWoorden(ing.naam).slice(-1)) {
    const s = stam(w)
    if (s.length < 3 || NIET_ALS_PRODUCT.has(s)) continue
    if (!telling.has(s)) telling.set(s, new Set())
    telling.get(s)!.add(i)
  }
})
const vocab = new Set([...telling].filter(([, v]) => v.size >= 5).map(([k]) => k))

const rapport: Array<{ titel: string; ongenoemd: string[]; ontbreekt: Array<{ stap: number; woord: string }> }> = []
let nIngredienten = 0, nOngenoemd = 0, nOntbreekt = 0

for (const r of recepten) {
  if (!r.bereiding_nl?.length) continue
  const alles = r.bereiding_nl.join(' ')
  const ongenoemd = r.ingredienten
    .filter((i) => zoekWoorden(i.naam).length > 0 && !noemtIngredient(alles, i.naam))
    .map((i) => i.naam)
  nIngredienten += r.ingredienten.length
  nOngenoemd += ongenoemd.length

  const eigen = r.ingredienten.flatMap((i) => productWoorden(i.naam))
  const ontbreekt: Array<{ stap: number; woord: string }> = []
  r.bereiding_nl.forEach((stap, idx) => {
    const gezien = new Set<string>()
    for (const w of woorden(stap)) {
      const s = stam(w)
      if (!vocab.has(s) || gezien.has(s)) continue
      gezien.add(s)
      if (eigen.some((e) => zelfdeWoord(w, e) || zelfdeWoord(e, w))) continue
      ontbreekt.push({ stap: idx + 1, woord: w })
    }
  })
  nOntbreekt += ontbreekt.length
  if (ongenoemd.length || ontbreekt.length) rapport.push({ titel: r.titel_nl ?? r.titel, ongenoemd, ontbreekt })
}

writeFileSync(arg('uit', 'stap_audit.json'), JSON.stringify(rapport, null, 1))
console.log(`${recepten.length} recepten, ${nIngredienten} ingrediënten`)
console.log(`Ingrediënten in geen enkele stap genoemd: ${nOngenoemd}`)
console.log(`Producten in een stap die niet in de lijst staan: ${nOntbreekt}`)
console.log(`Recepten met minstens één afwijking: ${rapport.length}`)
