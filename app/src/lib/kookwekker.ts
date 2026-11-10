import { KeepAwake } from '@capacitor-community/keep-awake'
import { Capacitor } from '@capacitor/core'
import { Haptics, NotificationType } from '@capacitor/haptics'
import { LocalNotifications } from '@capacitor/local-notifications'
import { t } from './taal'

/**
 * Het native deel van de kookmodus: scherm aan, en een timer die je ook hoort
 * met het scherm op slot.
 *
 * In de iOS-app plannen we bij het starten een lokale melding op het
 * eindtijdstip. iOS speelt dan zelf het geluid af, ook als de app in de
 * achtergrond staat of het scherm op slot is. In de browser kan dat niet;
 * daar piepen we via Web Audio zolang het tabblad open is.
 */

const MELDING_ID = 4711
const native = () => Capacitor.isNativePlatform()

type WakeLock = { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> }

/** Houdt het scherm aan; geeft een functie terug die het weer vrijgeeft. */
export function houdSchermAan(): () => void {
  if (native()) {
    void KeepAwake.keepAwake().catch(() => { /* niet beschikbaar */ })
    return () => { void KeepAwake.allowSleep().catch(() => { /* al vrij */ }) }
  }
  let sentinel: { release: () => Promise<void> } | null = null
  const wakeLock = (navigator as Navigator & { wakeLock?: WakeLock }).wakeLock
  void wakeLock?.request('screen').then((s) => { sentinel = s }).catch(() => { /* niet ondersteund */ })
  return () => { void sentinel?.release().catch(() => { /* al vrijgegeven */ }) }
}

/** Plant de melding voor het einde van de timer. Vraagt de eerste keer toestemming. */
export async function planWekker(eindOp: number, wat: string): Promise<void> {
  if (!native()) return
  try {
    let toestemming = await LocalNotifications.checkPermissions()
    if (toestemming.display === 'prompt' || toestemming.display === 'prompt-with-rationale') {
      toestemming = await LocalNotifications.requestPermissions()
    }
    if (toestemming.display !== 'granted') return
    await LocalNotifications.cancel({ notifications: [{ id: MELDING_ID }] })
    await LocalNotifications.schedule({
      notifications: [{
        id: MELDING_ID,
        title: t('Timer klaar'),
        body: wat,
        schedule: { at: new Date(eindOp), allowWhileIdle: true },
      }],
    })
  } catch {
    // Geen melding is jammer, maar de timer op het scherm loopt gewoon.
  }
}

/** Trekt een geplande melding in, bij pauzeren, stoppen of het scherm verlaten. */
export async function trekWekkerIn(): Promise<void> {
  if (!native()) return
  try {
    await LocalNotifications.cancel({ notifications: [{ id: MELDING_ID }] })
  } catch {
    // Niets om in te trekken.
  }
}

/**
 * Het moment dat de timer op nul komt terwijl je in de app bent. Een lokale
 * melding laat iOS in de voorgrond niet altijd horen, dus de app piept zelf,
 * op het toestel en in de browser, en trilt erbij.
 */
export function wekkerAfgelopen(): void {
  if (native()) {
    void Haptics.notification({ type: NotificationType.Warning }).catch(() => { /* geen trilmotor */ })
  } else {
    navigator.vibrate?.([300, 150, 300, 150, 300])
  }
  piep()
}

let geluid: AudioContext | null = null
let stopPiep: (() => void) | null = null

/**
 * Safari en de webview laten Web Audio pas klinken na een tik van de gebruiker.
 * Daarom maken we de context aan op het moment dat je de timer start, niet pas
 * bij nul.
 */
export function bereidGeluidVoor(): void {
  const AudioCtx = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtx) return
  geluid ??= new AudioCtx()
  void geluid.resume().catch(() => { /* geen geluid dan */ })
}

/** Zet een lopend alarm uit (de knop Klaar). */
export function stopWekkerGeluid(): void {
  stopPiep?.()
  stopPiep = null
}

/** Vier rondes van drie pieptonen: lang genoeg om het te horen vanaf de andere kant van de keuken. */
const RONDES = 4

function piep(): void {
  const ctx = geluid
  if (!ctx) return
  void ctx.resume().catch(() => { /* geen geluid dan */ })
  stopWekkerGeluid()
  const oscillatoren: OscillatorNode[] = []
  for (let ronde = 0; ronde < RONDES; ronde++) {
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator()
      const volume = ctx.createGain()
      osc.type = 'square'
      osc.frequency.value = 988
      osc.connect(volume)
      volume.connect(ctx.destination)
      const start = ctx.currentTime + ronde * 2 + i * 0.4
      volume.gain.setValueAtTime(0.25, start)
      volume.gain.exponentialRampToValueAtTime(0.001, start + 0.28)
      osc.start(start)
      osc.stop(start + 0.3)
      oscillatoren.push(osc)
    }
  }
  stopPiep = () => {
    for (const osc of oscillatoren) { try { osc.stop() } catch { /* al gestopt */ } }
  }
}
