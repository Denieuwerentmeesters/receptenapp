/**
 * Wat voor gerecht een recept is, afgeleid uit de titel: wrap, curry, soep.
 * Er is geen kolom voor; de generator kiest op keuken en bonus en zet dus
 * gerust twee keer wraps in één week. Hiermee halen we de tweede eruit.
 *
 * Alleen soorten waarvan je er geen twee in een week wilt. Staat er niets
 * herkenbaars in de titel, dan is er geen soort en blijft het recept staan.
 */
const SOORTEN: [soort: string, patroon: RegExp][] = [
  ['wrap', /wrap|burrito|quesadilla|fajita|enchilada|tortilla/],
  ['taco', /taco/],
  ['burger', /burger/],
  ['pizza', /pizza|flammkuchen|plaattaart/],
  ['lasagne', /lasagne|lasagna/],
  ['risotto', /risotto|orzotto/],
  ['curry', /curry|dal\b|dahl|korma|masala/],
  ['soep', /soep|ramen|pho\b|bouillabaisse|chowder/],
  ['stamppot', /stamppot|hutspot|boerenkool/],
  ['nasi', /nasi|bami|gebakken rijst/],
  ['noedels', /noedel|noodle|pad thai|mie\b/],
  ['salade', /salade|bowl/],
  ['quiche', /quiche|hartige taart/],
  ['ovenschotel', /ovenschotel|gratin|traybake/],
  ['pasta', /pasta|spaghetti|penne|tagliatelle|gnocchi|orzo|macaroni|ravioli|tortellini|fusilli|rigatoni|linguine|farfalle|pappardelle/],
]

export function gerechtSoort(titel: string): string | null {
  const t = titel.toLowerCase()
  return SOORTEN.find(([, patroon]) => patroon.test(t))?.[0] ?? null
}

/**
 * Haalt suggesties weg waarvan de soort al in de week zit. Wat je zelf koos
 * blijft altijd staan en telt als eerste; daarna de suggesties op volgorde.
 */
export function zonderDubbeleSoort<T extends { titel: string; titel_nl: string | null; gekozen: boolean }>(recepten: T[]): T[] {
  const soort = (r: T) => gerechtSoort(r.titel_nl ?? r.titel)
  const gezien = new Set(recepten.filter((r) => r.gekozen).map(soort))
  return recepten.filter((r) => {
    if (r.gekozen) return true
    const s = soort(r)
    if (s === null) return true
    if (gezien.has(s)) return false
    gezien.add(s)
    return true
  })
}
