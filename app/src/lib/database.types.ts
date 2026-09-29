/**
 * Handgeschreven spiegel van supabase/migrations/. Zodra het Supabase-project
 * bestaat vervang je dit bestand door de gegenereerde variant:
 *
 *   npx supabase gen types typescript --project-id <ref> > src/lib/database.types.ts
 */

export type BronType = 'scraper' | 'kookboek_foto' | 'eigen_input'
export type DeelStatus = 'prive' | 'aangevraagd' | 'goedgekeurd' | 'afgewezen'
export type AfbeeldingBron = 'gegenereerd' | 'origineel_bron' | 'kookboek_foto' | 'eigen_foto'

export interface Ingredient {
  hoeveelheid: string | null
  eenheid: string | null
  naam: string
}

export interface Gebruiker {
  id: string
  aangemaakt_op: string
}

export interface Recept {
  id: string
  user_id: string | null
  titel: string
  titel_nl: string | null
  bron: string
  url: string | null
  personen: number
  bereidingstijd_minuten: number | null
  keuken: string | null
  tags: string[]
  ingredienten: Ingredient[]
  bereiding_nl: string[]
  afbeelding_url: string | null
  afbeelding_bron: AfbeeldingBron | null
  bron_type: BronType
  deel_status: DeelStatus
  aangemaakt_op: string
  /** Ruwe schatting in euro's (lib/prijsschatting.ts); null als er niets te schatten viel. */
  prijs_pp_schatting: number | null
}

export interface WeekmenuGetoond {
  id: string
  user_id: string
  week_start_datum: string
  recept_id: string
  positie: number
  is_vegetarisch: boolean
}

export interface WeekmenuGekozen {
  id: string
  user_id: string
  week_start_datum: string
  recept_id: string
  gekozen_op: string
  gekookt_op: string | null
  aantal: number
  van_lijst_op: string | null
}

export interface Voorkeuren {
  user_id: string
  favoriete_keukens: string[]
  vega_minimum: number
  max_bereidingstijd: number | null
  biologisch_voorkeur: boolean
  voorkeurswinkel: 'ah' | 'jumbo'
  aantal_personen: number
  pushbericht_aan: boolean
  pushbericht_dag: number
  pushbericht_tijd: string
  bijgewerkt_op: string
}

export interface BoodschapItem {
  id: string
  user_id: string
  week_start_datum: string
  naam: string
  ingredient_key: string
  hoeveelheid: number | null
  eenheid: string | null
  categorie: string | null
  bron_type: 'recept' | 'extra'
  bron_recept_id: string | null
  is_afgevinkt: boolean
  aangemaakt_op: string
}

export interface Favoriet {
  user_id: string
  recept_id: string
  aangemaakt_op: string
}

export interface VoorraadRij {
  user_id: string
  ingredient_key: string
  naam: string
  categorie: string | null
  in_huis: boolean
  bijgewerkt_op: string
}

export interface AhProduct {
  ingredient_key: string
  weergavenaam: string | null
  standaard_product_id: number | null
  bio_product_id: number | null
  laatst_geverifieerd: string
}

/** SKU's zijn codes met een verpakkingsachtervoegsel ("641085STK"), geen getallen. */
export interface JumboProduct {
  ingredient_key: string
  weergavenaam: string | null
  standaard_sku: string | null
  bio_sku: string | null
  laatst_geverifieerd: string
}

type Tabel<Rij, Invoer = Partial<Rij>> = { Row: Rij; Insert: Invoer; Update: Partial<Rij> }

export interface Database {
  public: {
    Tables: {
      gebruiker: Tabel<Gebruiker>
      recepten: Tabel<Recept>
      weekmenu_getoond: Tabel<WeekmenuGetoond>
      weekmenu_gekozen: Tabel<WeekmenuGekozen>
      gebruiker_voorkeuren: Tabel<Voorkeuren>
      boodschappenlijst_item: Tabel<BoodschapItem>
      ah_product_cache: Tabel<AhProduct>
      jumbo_product_cache: Tabel<JumboProduct>
      favoriet: Tabel<Favoriet>
      voorraad_item: Tabel<VoorraadRij>
    }
    Views: Record<string, never>
    Functions: {
      genereer_weekmenu: {
        Args: { p_user_id: string; p_week_start?: string; p_aantal?: number }
        Returns: number
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
