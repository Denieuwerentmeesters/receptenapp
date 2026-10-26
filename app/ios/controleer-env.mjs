// Stopt `npm run testflight` als de Neon-gegevens ontbreken. Zonder die
// waarden slaagt de build wel, maar toont de app bij het opstarten "De app kan
// niet starten" en komt niemand binnen (Apple wees build 23 daarom af).
// .env.local staat in .gitignore: een verse checkout of worktree heeft 'm niet.
import { loadEnv } from 'vite'

const VERPLICHT = ['VITE_NEON_DATA_API_URL', 'VITE_NEON_AUTH_URL']

// Dezelfde volgorde als vite build: .env, .env.local, .env.production, ... en
// daarbovenop de omgeving van het proces.
const env = { ...loadEnv('production', process.cwd(), 'VITE_'), ...process.env }
const ontbreekt = VERPLICHT.filter((sleutel) => !env[sleutel])

if (ontbreekt.length > 0) {
  console.error(
    `\nNiet uploaden: ${ontbreekt.join(' en ')} ontbreekt.\n` +
    'Kopieer app/.env.local uit je hoofdmap naar deze map (zie .env.example) en draai opnieuw.\n',
  )
  process.exit(1)
}
