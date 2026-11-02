/**
 * De gratis grens voor recepten die AI voor je maakt, en wie er voorbij mag
 * (Kookmaatje Plus, tabel `abonnement`). Gedeeld door api/extraheer.ts en
 * api/samenstellen.ts: samen één teller, anders heb je er tien in plaats van vijf.
 *
 * Een recept telt als het lukte, niet pas als je het bewaart: de kosten zijn dan
 * al gemaakt. Dezelfde telling staat in app/src/lib/plus.ts voor de weergave.
 */
import type { NeonQueryFunction } from '@neondatabase/serverless'

/** In totaal, niet per maand. Wisselen kan zonder deploy. */
export const GRATIS_RECEPTEN = Number(process.env.GRATIS_RECEPTEN) || 5

export interface PlusStand {
  gebruikt: number
  plus: boolean
}

/**
 * Gelukte uitleesacties (`scan.telt_mee`) plus de gerechten van gelukte menu's
 * (`samenstelling` soort 'nieuw'; een aanpassing vervangt een gerecht en telt niet
 * nog eens; een mislukte aanvraag heeft geen `gerechten` in het antwoord).
 */
export async function plusStand(sql: NeonQueryFunction<false, false>, userId: string): Promise<PlusStand> {
  const [rij] = await sql`
    select
      (select count(*)::int from scan where user_id = ${userId} and telt_mee)
      + coalesce((
          select sum(jsonb_array_length(antwoord -> 'gerechten'))::int from samenstelling
          where user_id = ${userId} and soort = 'nieuw' and jsonb_typeof(antwoord -> 'gerechten') = 'array'
        ), 0) as gebruikt,
      exists (select 1 from abonnement where user_id = ${userId} and loopt_tot > now()) as plus
  ` as { gebruikt: number; plus: boolean }[]
  return rij
}

/** De melding als je er `nodig` wilt maken maar de gratis recepten (bijna) op zijn; anders null. */
export function limietMelding(stand: PlusStand, nodig = 1): string | null {
  if (stand.plus || stand.gebruikt + nodig <= GRATIS_RECEPTEN) return null
  const over = Math.max(0, GRATIS_RECEPTEN - stand.gebruikt)
  const kop = over === 0
    ? `Je ${GRATIS_RECEPTEN} gratis recepten zijn op.`
    : `Je hebt nog ${over} gratis ${over === 1 ? 'recept' : 'recepten'} over en dit zijn er ${nodig}.`
  return `${kop} Met Kookmaatje Plus (€ 3 per maand) laat je er zoveel maken als je wilt.`
}
