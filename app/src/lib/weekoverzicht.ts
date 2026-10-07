import { useMemo } from 'react'
import { useDezeWeek } from './queries'
import { useAllergieen, vastVoorJou } from './allergenen'
import { zonderDubbeleSoort } from './gerechtsoort'

/**
 * De recepten van een week zoals je ze ziet, voor het scherm en voor het
 * cijfer op de onderbalk.
 *
 * - Een suggestie met een allergeen zonder vervanger laten we weg, ook als je
 *   je allergie pas instelde nadat dit weekmenu er al stond. Wat je zelf koos
 *   blijft staan.
 * - Wat gekookt en opgeruimd is staat er niet meer.
 * - Van elke soort gerecht één suggestie (lib/gerechtsoort.ts).
 * - Heb je besteld (`besteld_op` op een recept van deze week), dan blijft alleen
 *   staan wat je koos: daar kook je van. De overige suggesties zijn weg.
 */
export function useWeekRecepten(week: string) {
  const query = useDezeWeek(week)
  const allergieen = useAllergieen()

  const besteld = useMemo(
    () => new Set((query.data ?? []).filter((r) => r.besteldOp).map((r) => r.id)),
    [query.data],
  )
  const recepten = useMemo(() => {
    const veilig = (query.data ?? [])
      .filter((r) => !r.opgeruimdOp)
      .filter((r) => r.gekozen || vastVoorJou(r, allergieen).length === 0)
    const gekozen = veilig.filter((r) => r.gekozen)
    // Besteld en daarna alles weggehaald: dan liever de suggesties dan een leeg scherm.
    if (besteld.size > 0 && gekozen.length > 0) return gekozen
    return zonderDubbeleSoort(veilig)
  }, [query.data, allergieen, besteld])

  return { query, recepten, isBesteld: besteld.size > 0 && recepten.every((r) => r.gekozen) && recepten.length > 0, besteld }
}
