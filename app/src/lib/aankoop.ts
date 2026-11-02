import { Capacitor } from '@capacitor/core'
import { huidigeUserId } from './auth'

/**
 * Kookmaatje Plus kopen: een abonnement via Apple, beheerd door RevenueCat.
 *
 * Apple eist een in-app aankoop voor alles wat functies in de app ontgrendelt
 * (App Review 3.1.1), dus geen Stripe in de app. RevenueCat praat met StoreKit
 * en meldt elke wijziging aan api/revenuecat.ts, dat `abonnement` bijwerkt.
 * Wat er telt is die rij: de server weigert de zesde AI-recept zonder. De
 * uitkomst hier is alleen om de knop te laten werken.
 *
 * RevenueCat kent je onder je Neon-id (logIn), zodat de webhook zonder
 * koppeltabel weet bij wie het hoort.
 *
 * Alleen in de iOS-app. In de browser is er niets te kopen (`kanKopen`).
 */

/** De publieke SDK-sleutel van RevenueCat voor iOS ("appl_…"); mag in de bundle. */
const SLEUTEL = import.meta.env.VITE_REVENUECAT_IOS_KEY as string | undefined

export const kanKopen = () => Capacitor.isNativePlatform() && !!SLEUTEL

export interface PlusAanbod {
  /** Wat Apple laat zien in de taal van de gebruiker, bijvoorbeeld "€ 2,99". */
  prijs: string
  /** Wordt aan purchasePackage meegegeven. */
  pakket: unknown
}

let verbondenMet: string | null = null

async function purchases() {
  return (await import('@revenuecat/purchases-capacitor')).Purchases
}

/** Configureert RevenueCat één keer en logt in met het Neon-id van deze gebruiker. */
async function verbind(): Promise<void> {
  if (!kanKopen()) throw new Error('Kopen kan alleen in de Kookmaatje-app.')
  const userId = await huidigeUserId()
  if (verbondenMet === userId) return
  const Purchases = await purchases()
  if (verbondenMet === null) {
    await Purchases.configure({ apiKey: SLEUTEL!, appUserID: userId })
  } else {
    await Purchases.logIn({ appUserID: userId })
  }
  verbondenMet = userId
}

/** Het abonnement dat in RevenueCat als huidig staat, met de prijs zoals Apple die toont. */
export async function haalAanbod(): Promise<PlusAanbod | null> {
  await verbind()
  const { current } = await (await purchases()).getOfferings()
  const pakket = current?.monthly ?? current?.availablePackages[0]
  return pakket ? { prijs: pakket.product.priceString, pakket } : null
}

/** Uitkomst van een aankoop: 'geannuleerd' is geen fout, de gebruiker zag het blad en sloot het. */
export type Aankoop = 'gelukt' | 'geannuleerd'

export async function koop(aanbod: PlusAanbod): Promise<Aankoop> {
  await verbind()
  try {
    await (await purchases()).purchasePackage({ aPackage: aanbod.pakket as never })
    return 'gelukt'
  } catch (e) {
    if ((e as { userCancelled?: boolean }).userCancelled) return 'geannuleerd'
    throw new Error('De aankoop is niet gelukt. Er is niets afgeschreven; probeer het later opnieuw.')
  }
}

/** Apple eist een knop om eerdere aankopen te herstellen (nieuw toestel, opnieuw geïnstalleerd). */
export async function herstel(): Promise<void> {
  await verbind()
  try {
    await (await purchases()).restorePurchases()
  } catch {
    throw new Error('Herstellen lukte niet. Probeer het later opnieuw.')
  }
}
