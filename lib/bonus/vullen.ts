import type { NeonQueryFunction } from '@neondatabase/serverless'
import { haalActies, koppel, type GekoppeldeActie, type MappingRij, type Winkel } from './prijsprofeet'
import { receptBonus, type BonusActie, type BonusMap } from '../../app/src/lib/bonusRegels'
import { ingredientKey } from '../../app/src/lib/schaal'
import { canoniek } from '../../app/src/lib/synoniemen'
import type { Ingredient } from '../../app/src/lib/database.types'

/**
 * Welke recepten hun hoofdingrediënt in de bonus hebben, met dezelfde regel
 * als het label in de app. Eén rij per recept per geldigheid.
 */
function receptenInBonus(recepten: { id: string; ingredienten: Ingredient[] }[], rijen: GekoppeldeActie[]) {
  const bonus: BonusMap = {}
  for (const r of rijen) {
    const actie: BonusActie = {
      ingredient_key: r.ingredientKey, titel: r.titel, prijs_nu: r.prijsNu, prijs_was: r.prijsWas,
      mechanisme: r.mechanisme, geldig_van: r.geldigVan, geldig_tot: r.geldigTot,
    }
    ;(bonus[canoniek(r.ingredientKey)] ??= []).push(actie)
  }
  const uit: { receptId: string; key: string; van: string; tot: string }[] = []
  for (const recept of recepten) {
    const treffer = receptBonus(recept.ingredienten ?? [], bonus)
    if (!treffer) continue
    const gezien = new Set<string>()
    for (const a of treffer.acties) {
      if (gezien.has(a.geldig_van)) continue
      gezien.add(a.geldig_van)
      uit.push({ receptId: recept.id, key: ingredientKey(treffer.naam), van: a.geldig_van, tot: a.geldig_tot })
    }
  }
  return uit
}

type Sql = NeonQueryFunction<false, false>

/**
 * Haalt de acties van AH en Jumbo op, koppelt ze aan de mapping uit de
 * database en vervangt per winkel alle rijen in bonus_actie in één
 * transactie, samen met recept_bonus (welke recepten daardoor in de bonus
 * zijn; die weegt mee in genereer_weekmenu). Mislukt één winkel, dan blijft
 * die staan zoals hij was.
 * Gebruikt door de cron (api/bonus.ts) en scripts/bonus_ophalen.ts.
 */
export async function vulBonus(sql: Sql, apiKey?: string): Promise<Record<Winkel, { acties: number; gekoppeld: number; recepten: number } | { fout: string }>> {
  const [ah, jumbo, recepten] = await Promise.all([
    sql`select ingredient_key, weergavenaam, standaard_product_id, bio_product_id, huismerk_product_id from ah_product_cache`,
    sql`select ingredient_key, weergavenaam, standaard_sku, bio_sku, huismerk_sku from jumbo_product_cache`,
    sql`select id, ingredienten from recepten`,
  ])
  const mapping: Record<Winkel, MappingRij[]> = {
    ah: ah.map((r) => ({ key: r.ingredient_key, naam: r.weergavenaam, nummers: [r.standaard_product_id, r.bio_product_id, r.huismerk_product_id] })),
    jumbo: jumbo.map((r) => ({ key: r.ingredient_key, naam: r.weergavenaam, nummers: [r.standaard_sku, r.bio_sku, r.huismerk_sku] })),
  }

  const uitkomst = {} as Record<Winkel, { acties: number; gekoppeld: number; recepten: number } | { fout: string }>
  for (const winkel of ['ah', 'jumbo'] as Winkel[]) {
    try {
      const acties = await haalActies(winkel, apiKey)
      const rijen = koppel(winkel, acties, mapping[winkel])
      const inBonus = receptenInBonus(recepten as { id: string; ingredienten: Ingredient[] }[], rijen)
      await sql.transaction([
        sql`delete from recept_bonus where winkel = ${winkel}`,
        ...inBonus.map((r) => sql`
          insert into recept_bonus (recept_id, winkel, ingredient_key, geldig_van, geldig_tot)
          values (${r.receptId}, ${winkel}, ${r.key}, ${r.van}, ${r.tot})
          on conflict (recept_id, winkel, geldig_van) do nothing`),
        sql`delete from bonus_actie where winkel = ${winkel} and bron = 'prijsprofeet'`,
        ...rijen.map((r) => sql`
          insert into bonus_actie
            (winkel, extern_id, ingredient_key, titel, prijs_nu, prijs_was, mechanisme, geldig_van, geldig_tot, product_url)
          values
            (${r.winkel}, ${r.externId}, ${r.ingredientKey}, ${r.titel}, ${r.prijsNu}, ${r.prijsWas},
             ${r.mechanisme}, ${r.geldigVan}, ${r.geldigTot}, ${r.productUrl})
          on conflict (winkel, extern_id, ingredient_key, geldig_van) do nothing`),
      ])
      uitkomst[winkel] = { acties: acties.length, gekoppeld: rijen.length, recepten: new Set(inBonus.map((r) => r.receptId)).size }
    } catch (fout) {
      uitkomst[winkel] = { fout: fout instanceof Error ? fout.message : String(fout) }
    }
  }
  return uitkomst
}
