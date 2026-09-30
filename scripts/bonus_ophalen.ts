/**
 * Vult bonus_actie nu meteen, met dezelfde code als de nachtelijke cron
 * (api/bonus.ts). Handig na een deploy of om te testen.
 *
 *   export DATABASE_URL=...
 *   npm run bonus-ophalen
 *
 * Of zonder lokale DATABASE_URL: gh workflow run bonus.yml
 */

import { neon } from '@neondatabase/serverless'
import { vulBonus } from '../lib/bonus/vullen'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL ontbreekt.')
  process.exit(1)
}
const uitkomst = await vulBonus(neon(url), process.env.PRIJSPROFEET_API_KEY || undefined)
console.log(JSON.stringify(uitkomst, null, 2))
if (Object.values(uitkomst).some((u) => 'fout' in u)) process.exit(1)
