/**
 * De naam van een recept zoals die in een link staat: "Crème brûlée (snel)"
 * wordt "creme-brulee-snel". Spiegel van recept_slug() in de database
 * (db/migrations/20261004200000_recept_slug.sql).
 *
 * Zonder imports: api/recept.ts gebruikt dit ook.
 */
export function naamSlug(titel: string): string {
  const slug = titel
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '')
  return slug || 'recept'
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const MET_ID = new RegExp(`^(?:.*-)?(${UUID})$`, 'i')

/**
 * Het pad achter /r/ voor een recept. Uit de pool is dat de slug; een eigen
 * recept houdt het id erachter, want dat id is wat de link geheim houdt.
 */
export function receptPad(recept: { id: string; slug?: string | null; titel: string; titel_nl: string | null }): string {
  return recept.slug ?? `${naamSlug(recept.titel_nl ?? recept.titel)}-${recept.id}`
}

/** Wat er achter /r/ stond: een id (kaal of achter een naam), of anders een slug. */
export function leesReceptPad(pad: string): { id: string } | { slug: string } | null {
  const metId = MET_ID.exec(pad)
  if (metId) return { id: metId[1].toLowerCase() }
  if (/^[a-z0-9]+(-[a-z0-9]+)*$/.test(pad) && pad.length <= 100) return { slug: pad }
  return null
}
