import { useMemo } from 'react'
import { useActieveWeek, useDezeWeek, type WeekRecept } from './queries'
import { useAllergieen, vastVoorJou } from './allergenen'
import { zonderDubbeleSoort } from './gerechtsoort'
import { volgendeWeek } from './week'
import { laagBeoordeeld, useBeoordelingen } from './beoordeling'

/**
 * Mijn recepten: waar een recept staat hangt af van de fase, niet van de
 * kalenderweek.
 *
 * - Te koken: op een bevestigde bestelling (`besteld_op`), nog niet gekookt.
 * - Nog bestellen: gekozen, nog niet besteld.
 * - Gekookt: `gekookt_op`; dat staat in het derde onderdeel, Eerder gekookt.
 *
 * Er is geen statuskolom: `weekmenu_gekozen` had `besteld_op`, `gekookt_op` en
 * `opgeruimd_op` al. Onder de motorkap blijven er weken (de generator maakt
 * per week suggesties, de lijst loopt over deze en komende week); de fases
 * lopen over die twee weken heen. Een recept besteld op zaterdag en gekookt
 * op dinsdag blijft dus gewoon bij Te koken.
 */

/** Een recept in Mijn recepten, met de week waar de rij in staat. */
export interface FaseRecept extends WeekRecept {
  week: string
}

export interface Fases {
  teKoken: FaseRecept[]
  nogBestellen: FaseRecept[]
  /** Suggesties van de generator voor de week waarin je nu bestelt. */
  suggesties: FaseRecept[]
  /** De week waar nieuwe keuzes in komen: deze, of komende als deze al besteld is. */
  bestelWeek: string
}

const open = (r: WeekRecept) => r.gekozen && !r.gekooktOp && !r.opgeruimdOp

/**
 * Verdeelt de recepten van deze en komende week over de fases. Los van de
 * hook, zodat het te testen is.
 *
 * Een suggestie met een allergeen zonder vervanger laten we weg, ook als je
 * je allergie pas instelde nadat dit weekmenu er al stond. Wat je zelf koos
 * blijft staan. Van elke soort gerecht één suggestie (lib/gerechtsoort.ts).
 * Een recept waar je een 5 of lager voor gaf is ook geen suggestie meer.
 */
export function verdeelFases(
  week: string,
  deze: readonly WeekRecept[],
  komende: readonly WeekRecept[],
  allergieen: readonly string[] = [],
  laag: ReadonlySet<string> = new Set(),
): Fases {
  const komendeWeek = volgendeWeek(week)
  const alle: FaseRecept[] = [
    ...deze.map((r) => ({ ...r, week })),
    ...komende.map((r) => ({ ...r, week: komendeWeek })),
  ]
  const gezien = new Set<string>()
  const eenmaal = (r: FaseRecept) => {
    if (gezien.has(r.id)) return false
    gezien.add(r.id)
    return true
  }

  const teKoken = alle.filter((r) => open(r) && r.besteldOp).filter(eenmaal)
  const nogBestellen = alle.filter((r) => open(r) && !r.besteldOp).filter(eenmaal)

  // Is er in deze week al besteld, dan komt een nieuwe ronde in komende week:
  // dan schuift die mee als deze week straks gekookt is.
  const besteld = deze.some((r) => r.besteldOp && !r.opgeruimdOp)
  const bestelWeek = besteld ? komendeWeek : week
  const kandidaten = alle
    .filter((r) => r.week === bestelWeek && !r.opgeruimdOp)
    .filter((r) => r.gekozen || vastVoorJou(r, allergieen).length === 0)
  const suggesties = zonderDubbeleSoort(kandidaten.filter((r) => r.gekozen || !laag.has(r.id)))
    .filter((r) => !r.gekozen).filter(eenmaal)

  return { teKoken, nogBestellen, suggesties, bestelWeek }
}

export function useFases() {
  const week = useActieveWeek()
  const deze = useDezeWeek(week)
  const komende = useDezeWeek(volgendeWeek(week))
  const allergieen = useAllergieen()
  const { perRecept } = useBeoordelingen()
  const fases = useMemo(
    () => verdeelFases(week, deze.data ?? [], komende.data ?? [], allergieen, laagBeoordeeld(perRecept)),
    [week, deze.data, komende.data, allergieen, perRecept],
  )
  return { ...fases, week, query: deze, komendeQuery: komende }
}
