import { useMutation, useQueryClient } from '@tanstack/react-query'
import { effectieveUserId, gedeeld } from './huishouden'
import { useActieveWeek } from './queries'
import { volgendeWeek, weekStart } from './week'

/**
 * Van deze week naar de volgende, los van de kalender.
 *
 * "Deze week" is de week van je bestelling. Is alles daarvan gekookt, of zeg
 * je een week na het bestellen dat je klaar bent, dan schuift komende week
 * door: `gebruiker_voorkeuren.actieve_week` wijst de nieuwe week aan. Wat je
 * nog wilt koken gaat mee, en wat nog op je lijst stond ook.
 */

/** Een rij uit weekmenu_gekozen, voor zover het doorschuiven ernaar kijkt. */
export interface Keuze {
  recept_id: string
  aantal: number
  van_lijst_op: string | null
  gekookt_op: string | null
  besteld_op: string | null
}

/** De week waar je naartoe schuift: de volgende, maar nooit een week die al voorbij is. */
export function doelWeek(week: string, vandaag = new Date()): string {
  const volgende = volgendeWeek(week)
  const kalender = weekStart(vandaag)
  return volgende > kalender ? volgende : kalender
}

/**
 * Wat meegaat naar de volgende week: wat nog op je lijst staat (dat moet je
 * nog kopen), en van wat besteld is alleen wat je aanwees. Gekookt gaat nooit mee.
 */
export function watGaatMee(keuzes: Keuze[], meenemen: readonly string[]): Keuze[] {
  return keuzes.filter((k) => !k.gekookt_op && (k.van_lijst_op === null || meenemen.includes(k.recept_id)))
}

/** Besteld en nog niet gekookt: daar wacht de week op. */
export function nogTeKoken<T extends { besteldOp: string | null; gekooktOp: string | null }>(recepten: T[]): T[] {
  return recepten.filter((r) => r.besteldOp && !r.gekooktOp)
}

/** Na zoveel dagen vragen we of alles gekookt is. */
export const VRAAG_NA_DAGEN = 7

/** Is de oudste bestelling waar nog iets van te koken valt een week oud? */
export function weekVoorbij<T extends { besteldOp: string | null; gekooktOp: string | null }>(recepten: T[], nu = Date.now()): boolean {
  const open = nogTeKoken(recepten)
  if (open.length === 0) return false
  const oudste = Math.min(...open.map((r) => new Date(r.besteldOp!).getTime()))
  return nu - oudste >= VRAAG_NA_DAGEN * 24 * 60 * 60 * 1000
}

async function schuifDoor(week: string, meenemen: readonly string[]): Promise<void> {
  const id = await effectieveUserId()
  const doel = doelWeek(week)
  const nu = new Date().toISOString()

  const keuzes = await (await gedeeld('weekmenu_gekozen'))
    .select('recept_id, aantal, van_lijst_op, gekookt_op, besteld_op').eq('week_start_datum', week)
  if (keuzes.error) throw keuzes.error
  const mee = watGaatMee(keuzes.data as Keuze[], meenemen)

  if (mee.length > 0) {
    // Besteld gaat mee als besteld, met de datum van nu: over een week vragen we het opnieuw.
    const { error } = await (await gedeeld('weekmenu_gekozen')).upsert(mee.map((k) => ({
      user_id: id,
      week_start_datum: doel,
      recept_id: k.recept_id,
      aantal: k.aantal,
      van_lijst_op: k.van_lijst_op === null ? null : nu,
      besteld_op: k.besteld_op ? nu : null,
    })), { onConflict: 'user_id,week_start_datum,recept_id' })
    if (error) throw error
  }

  // De lijst verhuist mee; wat bij een recept hoort dat achterblijft gaat eraf.
  const blijft = mee.filter((k) => k.van_lijst_op === null).map((k) => k.recept_id)
  let weg = (await gedeeld('boodschappenlijst_item')).delete()
    .eq('week_start_datum', week).not('bron_recept_id', 'is', null)
  if (blijft.length > 0) weg = weg.not('bron_recept_id', 'in', `(${blijft.join(',')})`)
  const gewist = await weg
  if (gewist.error) throw gewist.error
  const verhuisd = await (await gedeeld('boodschappenlijst_item')).update({ week_start_datum: doel })
    .eq('week_start_datum', week)
  if (verhuisd.error) throw verhuisd.error

  // Loopt de nieuwe week gelijk met de kalender en wacht er niets besteld op,
  // dan hoeft er niets vast te staan: null volgt de kalender weer.
  const vast = doel > weekStart() || mee.some((k) => k.besteld_op)
  const { error } = await (await gedeeld('gebruiker_voorkeuren'))
    .update({ actieve_week: vast ? doel : null }).eq('user_id', id)
  if (error) throw error
}

export function useWeekWissel() {
  const week = useActieveWeek()
  const qc = useQueryClient()
  const allesVerversen = () => qc.invalidateQueries()

  /**
   * Na het koken. Met `opruimen` gaat het recept ook uit Deze week en van je
   * lijst. Was dit het laatste bestelde recept, dan schuift de week door.
   * Staat het recept niet in je week (gekookt vanuit Ontdekken), dan gebeurt er niets.
   */
  const gekookt = useMutation({
    mutationFn: async ({ receptId, opruimen, inWeek = week }: {
      receptId: string
      opruimen: boolean
      /** De week waar het recept in staat: deze, of komende als je vooruit kookt. */
      inWeek?: string
    }): Promise<{ doorgeschoven: boolean }> => {
      const nu = new Date().toISOString()
      const { error } = await (await gedeeld('weekmenu_gekozen'))
        .update(opruimen ? { gekookt_op: nu, opgeruimd_op: nu, van_lijst_op: nu } : { gekookt_op: nu })
        .eq('week_start_datum', inWeek).eq('recept_id', receptId)
      if (error) throw error
      if (opruimen) {
        const items = await (await gedeeld('boodschappenlijst_item')).delete()
          .eq('week_start_datum', inWeek).eq('bron_recept_id', receptId)
        if (items.error) throw items.error
      }

      const besteld = await (await gedeeld('weekmenu_gekozen')).select('gekookt_op')
        .eq('week_start_datum', week).not('besteld_op', 'is', null)
      if (besteld.error) throw besteld.error
      const rijen = besteld.data as { gekookt_op: string | null }[]
      if (rijen.length === 0 || rijen.some((r) => !r.gekookt_op)) return { doorgeschoven: false }
      await schuifDoor(week, [])
      return { doorgeschoven: true }
    },
    onSettled: allesVerversen,
  })

  /**
   * Het antwoord op "alles gekookt?". `meenemen` zijn de bestelde recepten die
   * je nog gaat koken; leeg betekent dat alles op is. De rest is gekookt.
   */
  const rondAf = useMutation({
    mutationFn: async (meenemen: readonly string[]) => {
      const nu = new Date().toISOString()
      let klaar = (await gedeeld('weekmenu_gekozen')).update({ gekookt_op: nu, opgeruimd_op: nu })
        .eq('week_start_datum', week).not('besteld_op', 'is', null).is('gekookt_op', null)
      if (meenemen.length > 0) klaar = klaar.not('recept_id', 'in', `(${meenemen.join(',')})`)
      const { error } = await klaar
      if (error) throw error
      await schuifDoor(week, meenemen)
    },
    onSettled: allesVerversen,
  })

  /** Een week die voorbij is en waar niets besteld meer op wacht: stil verder. */
  const haalIn = useMutation({
    mutationFn: () => schuifDoor(week, []),
    onSettled: allesVerversen,
  })

  return { gekookt, rondAf, haalIn }
}
