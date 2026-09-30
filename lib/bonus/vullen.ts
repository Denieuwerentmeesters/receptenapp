import type { NeonQueryFunction } from '@neondatabase/serverless'
import { haalActies, koppel, type MappingRij, type Winkel } from './prijsprofeet'

type Sql = NeonQueryFunction<false, false>

/**
 * Haalt de acties van AH en Jumbo op, koppelt ze aan de mapping uit de
 * database en vervangt per winkel alle rijen in bonus_actie in één
 * transactie. Mislukt één winkel, dan blijft die staan zoals hij was.
 * Gebruikt door de cron (api/bonus.ts) en scripts/bonus_ophalen.ts.
 */
export async function vulBonus(sql: Sql, apiKey?: string): Promise<Record<Winkel, { acties: number; gekoppeld: number } | { fout: string }>> {
  const [ah, jumbo] = await Promise.all([
    sql`select ingredient_key, weergavenaam, standaard_product_id, bio_product_id, huismerk_product_id from ah_product_cache`,
    sql`select ingredient_key, weergavenaam, standaard_sku, bio_sku, huismerk_sku from jumbo_product_cache`,
  ])
  const mapping: Record<Winkel, MappingRij[]> = {
    ah: ah.map((r) => ({ key: r.ingredient_key, naam: r.weergavenaam, nummers: [r.standaard_product_id, r.bio_product_id, r.huismerk_product_id] })),
    jumbo: jumbo.map((r) => ({ key: r.ingredient_key, naam: r.weergavenaam, nummers: [r.standaard_sku, r.bio_sku, r.huismerk_sku] })),
  }

  const uitkomst = {} as Record<Winkel, { acties: number; gekoppeld: number } | { fout: string }>
  for (const winkel of ['ah', 'jumbo'] as Winkel[]) {
    try {
      const acties = await haalActies(winkel, apiKey)
      const rijen = koppel(winkel, acties, mapping[winkel])
      await sql.transaction([
        sql`delete from bonus_actie where winkel = ${winkel} and bron = 'prijsprofeet'`,
        ...rijen.map((r) => sql`
          insert into bonus_actie
            (winkel, extern_id, ingredient_key, titel, prijs_nu, prijs_was, mechanisme, geldig_van, geldig_tot, product_url)
          values
            (${r.winkel}, ${r.externId}, ${r.ingredientKey}, ${r.titel}, ${r.prijsNu}, ${r.prijsWas},
             ${r.mechanisme}, ${r.geldigVan}, ${r.geldigTot}, ${r.productUrl})
          on conflict (winkel, extern_id, ingredient_key, geldig_van) do nothing`),
      ])
      uitkomst[winkel] = { acties: acties.length, gekoppeld: rijen.length }
    } catch (fout) {
      uitkomst[winkel] = { fout: fout instanceof Error ? fout.message : String(fout) }
    }
  }
  return uitkomst
}
