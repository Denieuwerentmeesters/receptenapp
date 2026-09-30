/**
 * Nachtelijke ophaalronde voor bonus en aanbiedingen (plan "gemak en bonus",
 * onderdeel 5).
 *
 * Vercel Cron roept dit elke nacht aan (zie vercel.json). Haalt de lopende en
 * komende acties van AH en Jumbo op bij PrijsProfeet, koppelt ze op
 * productnummer aan ah_product_cache en jumbo_product_cache, en vervangt per
 * winkel alle rijen in bonus_actie in één transactie. Mislukt één winkel, dan
 * blijft die winkel staan zoals hij was.
 *
 * Omgevingsvariabelen op Vercel: DATABASE_URL, CRON_SECRET (Vercel stuurt die
 * zelf mee) en optioneel PRIJSPROFEET_API_KEY. Zonder key werkt het ook, maar
 * dan telt de limiet (30/min) op het gedeelde IP van Vercel en duurt het
 * ophalen twee minuten.
 */

import { neon } from '@neondatabase/serverless'
import { vulBonus } from '../lib/bonus/vullen'

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ fout: 'Geen toegang.' }, { status: 401 })
  }
  const url = process.env.DATABASE_URL
  if (!url) return Response.json({ fout: 'DATABASE_URL ontbreekt.' }, { status: 500 })

  const uitkomst = await vulBonus(neon(url), process.env.PRIJSPROFEET_API_KEY || undefined)
  console.log('bonus:', JSON.stringify(uitkomst))
  return Response.json(uitkomst)
}
