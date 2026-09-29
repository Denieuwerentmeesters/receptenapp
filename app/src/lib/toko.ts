import { zoekProduct } from './ah'
import { ingredientKey } from './schaal'
import type { BoodschapItem, Ingredient } from './database.types'

/**
 * Wat je bij AH en Jumbo niet (goed) krijgt, maar wel bij Tjin's Toko:
 * limoenblaadjes, gula jawa, kemirinoten. Voor die regels toont de lijst
 * "toko" in plaats van "zoek", met een link naar het product daar.
 *
 * Geen databasetabel zoals bij AH en Jumbo: het is een handvol producten, en
 * er gaat niets naar een mandje — het is alleen een link. Nagelopen op
 * tjinstoko.eu; komt er een ingrediënt bij, voeg het hier toe.
 */
export interface TokoProduct {
  naam: string
  url: string
}

const TJIN = 'https://www.tjinstoko.eu/nl/'

const product = (naam: string, pad: string): TokoProduct => ({ naam, url: `${TJIN}${pad}.html` })

const LIMOENBLAADJES = product('Cock Brand Dried Kaffir Lime Leaves, 10g', 'dried-kaffir-lime-leaves-10g')
const GULA_JAWA = product('Wayang Gula Jawa, 250g', 'wayang-gula-jawa-250g')
const KEMIRI = product('Lucullus Kemiri Noten, 1kg', 'lucullus-kemiri-noten-1kg')
const LAOS = product('Laos Poeder Gemalen, 40g', 'laos-poeder-gemalen-40g')
const SEROENDENG = product('Kokki Djawa Seroendeng, 185g', 'kokki-djawa-seroendeng-185g')
const SHAOXING = product('Taiwan Shaohsing Wine, 600ml', 'taiwan-shaohsing-wine-600ml')

/** Sleutels zoals ingredientKey ze maakt (enkelvoud, zonder accenten). */
const TOKO: Record<string, TokoProduct> = {
  'limoenblaadje': LIMOENBLAADJES,
  'kaffirlimoenblaadje': LIMOENBLAADJES,
  'djeruk purut': LIMOENBLAADJES,
  'djeroek poeroet blaadje': LIMOENBLAADJES,
  'palmsuiker': GULA_JAWA,
  'javaanse suiker': GULA_JAWA,
  'gula jawa': GULA_JAWA,
  'kemirinoten': KEMIRI,
  'kemiri noten': KEMIRI,
  'laos': LAOS,
  'laospoeder': LAOS,
  'seroendeng': SEROENDENG,
  'serundeng': SEROENDENG,
  'shaoxing rijstwijn': SHAOXING,
  'chinese kookwijn': SHAOXING,
  'katsuobushi': product('Wadakyu Bonito (Katsuobushi) Flakes, 40g', 'wadakyu-bonito-katsuobushi-flakes-40g'),
  'furikake': product('Nihon Kaisu Nori Furikake, 50g', 'nihon-kaisu-nori-furikake-50g'),
  'bananenblad': product('Daily Bananenbladeren, 454g', 'daily-bananenbladeren-454g'),
  'pul biber': product('Pul Biber Hot Peper, 50g', 'pul-biber-hot-peper-50g'),
  'trassipoeder': product('Flower Brand Trassi Poeder, 70g', 'flower-brand-trassi-poeder-70g'),
}

/** Zelfde zoekregels als bij de winkels: enkelvoud en hele woorden ("sake shaoxing rijstwijn"). */
export function tokoProduct(item: Pick<BoodschapItem, 'ingredient_key' | 'naam'>): TokoProduct | undefined {
  return zoekProduct(item, TOKO)
}

export interface TokoIngredient {
  naam: string
  product: TokoProduct
}

/**
 * Welke ingrediënten van dit recept haal je bij de toko? Zo zie je al bij het
 * kiezen dat je er niet met alleen een AH- of Jumbo-bestelling komt.
 */
export function tokoIngredienten(ingredienten: Ingredient[]): TokoIngredient[] {
  const uit: TokoIngredient[] = []
  for (const ing of ingredienten) {
    const product = tokoProduct({ ingredient_key: ingredientKey(ing.naam), naam: ing.naam })
    if (product) uit.push({ naam: ing.naam, product })
  }
  return uit
}
