/**
 * Rekent voor alle gescrapete recepten een geschatte prijs per persoon uit
 * (app/src/lib/prijsschatting.ts) en schrijft die als migratie weg:
 *
 *   npx tsx scripts/prijsschatting.ts db/migrations/<tijdstempel>_prijsschatting.sql
 *
 * De migratie draait na de merge vanzelf (GitHub Action "Migraties"). Er is
 * geen DATABASE_URL nodig: de recepten komen uit data/recepten.json en worden
 * op url gekoppeld. Eigen recepten krijgen hun schatting bij het opslaan.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { schatPrijsPerPersoon, BUDGET_PER_PERSOON } from '../app/src/lib/prijsschatting.ts'

const doel = process.argv[2]
if (!doel) {
  console.error('Gebruik: npx tsx scripts/prijsschatting.ts db/migrations/<naam>.sql')
  process.exit(1)
}

interface Bron { url: string | null; personen: number; ingredienten: { naam: string; hoeveelheid: string | null; eenheid: string | null }[] }
const recepten = JSON.parse(readFileSync('data/recepten.json', 'utf8')) as Bron[]

const sql = (s: string) => `'${s.replace(/'/g, "''")}'`
const rijen = recepten
  .filter((r) => r.url)
  .map((r) => ({ url: r.url as string, prijs: schatPrijsPerPersoon(r as never) }))
  .filter((r) => r.prijs !== null)

const budget = rijen.filter((r) => (r.prijs as number) <= BUDGET_PER_PERSOON).length
console.log(`${rijen.length} recepten geschat, ${budget} onder €${BUDGET_PER_PERSOON} p.p. (inclusief recepten die niet meer in de database staan)`)

writeFileSync(doel, `-- Gegenereerd door scripts/prijsschatting.ts — niet met de hand aanpassen.
--
-- Geschatte prijs per persoon per recept, voor het filter "Budget" (tot
-- €${BUDGET_PER_PERSOON.toFixed(2).replace('.', ',')} p.p.). Een schatting op basis van ingrediëntklassen, geen
-- AH-prijs: goed om goedkoop van duur te scheiden, niet om een exact bedrag
-- mee te adverteren. Zie app/src/lib/prijsschatting.ts.
--
-- Recepten die niet meer bestaan (desserts, hapjes) matchen gewoon niet.

alter table recepten add column if not exists prijs_pp_schatting numeric(6, 2);

create index if not exists recepten_prijs_pp_schatting on recepten (prijs_pp_schatting);

update recepten r
set prijs_pp_schatting = v.prijs
from (values
${rijen.map((r) => `  (${sql(r.url)}, ${(r.prijs as number).toFixed(2)})`).join(',\n')}
) as v (url, prijs)
where r.url = v.url and r.bron_type = 'scraper';
`)
console.log(`Geschreven: ${doel}`)
