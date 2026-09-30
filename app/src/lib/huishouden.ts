import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { db } from './db'
import { huidigeSessie, huidigeUserId } from './auth'

/**
 * Gedeelde lijst met je huisgenoot (plan "gemak en bonus", onderdeel 6;
 * issue #50, migratie 20261001100000_huishouden.sql).
 *
 * Een huishouden is de lijst van de eigenaar. Ben je lid, dan lees en schrijf
 * je de rijen van de eigenaar: weekmenu, boodschappenlijst, voorraadkast,
 * voorkeuren en bestellingen. Favorieten, beoordelingen en eigen recepten
 * blijven van jezelf. Je eigen lijst blijft bewaard en is terug als je het
 * huishouden verlaat.
 *
 * Door de RLS ziet een lid zowel zijn eigen rijen als die van de eigenaar.
 * Daarom lopen alle queries op die tabellen via gedeeld(): die filtert op de
 * effectieve gebruiker (jij, of de eigenaar van je huishouden).
 */

const GEDEELD = ['weekmenu_getoond', 'weekmenu_gekozen', 'boodschappenlijst_item',
  'voorraad_item', 'gebruiker_voorkeuren', 'bestelling'] as const
type GedeeldeTabel = (typeof GEDEELD)[number]

let effectief: Promise<string> | null = null

/** Van wie de gedeelde rijen zijn: de eigenaar van je huishouden, of jijzelf. */
export function effectieveUserId(): Promise<string> {
  effectief ??= (async () => {
    const ik = await huidigeUserId()
    const { data, error } = await db.from('huishouden_lid').select('eigenaar_id').eq('user_id', ik).maybeSingle()
    if (error) {
      // Bestaat de tabel nog niet (migratie niet gedraaid), dan gewoon jezelf.
      effectief = null
      return ik
    }
    return (data as { eigenaar_id: string } | null)?.eigenaar_id ?? ik
  })()
  return effectief
}

/** Na lid worden, verlaten of uitloggen: opnieuw bepalen van wie de rijen zijn. */
export function vergeetHuishouden() {
  effectief = null
}

/**
 * Een gedeelde tabel, gefilterd op de effectieve gebruiker. Insert en upsert
 * gaan ongewijzigd door; zet daar zelf user_id op effectieveUserId().
 */
export async function gedeeld<T extends GedeeldeTabel>(tabel: T) {
  const eigenaar = await effectieveUserId()
  // Als losse tabelnaam: de aanroepers casten de rijen zelf, zoals elders in de app.
  const t = () => db.from(tabel as string)
  return {
    eigenaar,
    select: <Q extends string = '*'>(kolommen?: Q) => t().select((kolommen ?? '*') as Q).eq('user_id', eigenaar),
    update: (waarden: Record<string, unknown>) => t().update(waarden).eq('user_id', eigenaar),
    delete: () => t().delete().eq('user_id', eigenaar),
    insert: (rijen: Record<string, unknown> | Record<string, unknown>[]) => t().insert(rijen),
    upsert: (rijen: Record<string, unknown> | Record<string, unknown>[], opties?: { onConflict?: string; ignoreDuplicates?: boolean }) =>
      t().upsert(rijen, opties),
  }
}

export interface Huishouden {
  /** Je bent lid bij iemand anders. */
  eigenaar: { id: string; email: string | null } | null
  /** Je bent zelf eigenaar en dit zijn je leden. */
  leden: { id: string; email: string | null; sinds: string }[]
  /** Openstaande uitnodiging, als je die maakte. */
  uitnodiging: { code: string; verloopt_op: string } | null
}

export function useHuishouden() {
  return useQuery({
    queryKey: ['huishouden'],
    queryFn: async (): Promise<Huishouden> => {
      const ik = await huidigeUserId()
      const [leden, uitnodiging] = await Promise.all([
        db.from('huishouden_lid').select('user_id, eigenaar_id, lid_email, eigenaar_email, sinds'),
        db.from('huishouden_uitnodiging').select('code, verloopt_op').gt('verloopt_op', new Date().toISOString())
          .order('aangemaakt_op', { ascending: false }).limit(1),
      ])
      if (leden.error) throw leden.error
      const rijen = leden.data as { user_id: string; eigenaar_id: string; lid_email: string | null; eigenaar_email: string | null; sinds: string }[]
      const mijn = rijen.find((r) => r.user_id === ik)
      return {
        eigenaar: mijn ? { id: mijn.eigenaar_id, email: mijn.eigenaar_email } : null,
        leden: rijen.filter((r) => r.eigenaar_id === ik).map((r) => ({ id: r.user_id, email: r.lid_email, sinds: r.sinds })),
        uitnodiging: (uitnodiging.data as { code: string; verloopt_op: string }[] | null)?.[0] ?? null,
      }
    },
  })
}

/** Deel je je lijst met iemand, als lid of als eigenaar met leden? */
export function useDeeltLijst(): boolean {
  const h = useHuishouden().data
  return Boolean(h && (h.eigenaar || h.leden.length > 0))
}

/** Acht tekens zonder O/0 en I/1, zodat je ze kunt voorlezen. */
function nieuweCode(): string {
  const tekens = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return [...bytes].map((b) => tekens[b % tekens.length]).join('')
}

export function useHuishoudenActies() {
  const qc = useQueryClient()
  // Na lid worden of verlaten gaan alle gedeelde gegevens om: alles opnieuw ophalen.
  const allesOpnieuw = async () => {
    vergeetHuishouden()
    await qc.invalidateQueries()
  }

  const maakUitnodiging = useMutation({
    mutationFn: async () => {
      const sessie = await huidigeSessie()
      if (!sessie) throw new Error('Niet ingelogd.')
      const { error } = await db.from('huishouden_uitnodiging')
        .insert({ code: nieuweCode(), eigenaar_id: sessie.userId, eigenaar_email: sessie.email } as never)
      if (error) throw error
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['huishouden'] }) },
  })

  /** Van wie is deze code? Null als de code niet (meer) geldig is. */
  const bekijkCode = async (code: string): Promise<{ id: string; email: string | null } | null> => {
    const { data, error } = await db.rpc('uitnodiging_info' as never, { p_code: code.trim().toUpperCase() } as never)
    if (error) throw error
    const rij = (data as { eigenaar_id: string; eigenaar_email: string | null }[] | null)?.[0]
    return rij ? { id: rij.eigenaar_id, email: rij.eigenaar_email } : null
  }

  const wordLid = useMutation({
    mutationFn: async ({ code, eigenaarId, eigenaarEmail }: { code: string; eigenaarId: string; eigenaarEmail: string | null }) => {
      const sessie = await huidigeSessie()
      if (!sessie) throw new Error('Niet ingelogd.')
      if (sessie.userId === eigenaarId) throw new Error('Dit is je eigen code.')
      const { error } = await db.from('huishouden_lid').insert({
        user_id: sessie.userId, eigenaar_id: eigenaarId, lid_email: sessie.email,
        eigenaar_email: eigenaarEmail, via_code: code.trim().toUpperCase(),
      } as never)
      if (error) throw error
    },
    onSuccess: allesOpnieuw,
  })

  /** Zelf weggaan, of als eigenaar een lid verwijderen. */
  const verlaat = useMutation({
    mutationFn: async (lidId?: string) => {
      const id = lidId ?? await huidigeUserId()
      const { error } = await db.from('huishouden_lid').delete().eq('user_id', id)
      if (error) throw error
    },
    onSuccess: allesOpnieuw,
  })

  return { maakUitnodiging, bekijkCode, wordLid, verlaat }
}
