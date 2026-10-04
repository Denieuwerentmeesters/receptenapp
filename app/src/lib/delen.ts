import { db } from './db'
import { WEBSITE } from './config'
import type { Recept } from './database.types'
import { receptPad } from './slug'

/**
 * Een recept delen via een link naar de website (/r/<naam>, api/recept.ts), zodat
 * ook iemand zonder account het kan lezen.
 */

/** De openbare link. Altijd op de website: de iOS-app heeft zelf geen https-adres. */
export function deelLink(recept: Pick<Recept, 'id' | 'slug' | 'titel' | 'titel_nl'>): string {
  return `${WEBSITE}/r/${receptPad(recept)}`
}

/** Kookboekrecepten gaan nooit de deur uit, ook niet via een link (auteursrecht, plan §7.3). */
export function magDelen(recept: Pick<Recept, 'bron_type'>): boolean {
  return recept.bron_type !== 'kookboek_foto'
}

/**
 * Of de link al werkt. De pool en goedgekeurd gedeelde recepten zijn er voor
 * iedereen; een eigen recept pas nadat je er zelf een link voor maakte.
 */
export function heeftLink(recept: Pick<Recept, 'user_id' | 'deel_status' | 'deellink_sinds'>): boolean {
  return recept.user_id === null || recept.deel_status === 'goedgekeurd' || Boolean(recept.deellink_sinds)
}

/** Zet de link van een eigen recept aan. RLS laat dit alleen de eigenaar doen. */
export async function maakDeellink(id: string): Promise<void> {
  const { error } = await db.from('recepten').update({ deellink_sinds: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export type DeelUitkomst = 'gedeeld' | 'gekopieerd' | 'afgebroken' | 'mislukt'

/**
 * Opent het deelvenster van de telefoon; kan dat niet (desktop), dan gaat de
 * link naar het klembord. Roep dit direct vanuit een tik aan: Safari weigert
 * het deelvenster als er eerst op iets gewacht is.
 */
export async function deel(titel: string, url: string): Promise<DeelUitkomst> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: titel, url })
      return 'gedeeld'
    } catch (e) {
      // Zelf weggetikt: dan ook niet stilletjes iets op het klembord zetten.
      if (e instanceof DOMException && e.name === 'AbortError') return 'afgebroken'
    }
  }
  try {
    await navigator.clipboard.writeText(url)
    return 'gekopieerd'
  } catch {
    return 'mislukt'
  }
}
