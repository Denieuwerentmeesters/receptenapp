import { KeepAwake } from '@capacitor-community/keep-awake'
import { Capacitor } from '@capacitor/core'
import { Haptics, NotificationType } from '@capacitor/haptics'
import { LocalNotifications } from '@capacitor/local-notifications'

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
        title: 'Timer klaar',
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

/** Het moment dat de timer op nul komt terwijl je in de app bent. */
export function wekkerAfgelopen(): void {
  if (native()) {
    // Het geluid komt van de melding zelf; hier alleen de tik in je hand.
    void Haptics.notification({ type: NotificationType.Warning }).catch(() => { /* geen trilmotor */ })
    return
  }
  navigator.vibrate?.([300, 150, 300, 150, 300])
  piep()
}

let geluid: AudioContext | null = null

/**
 * Safari laat Web Audio pas klinken na een tik van de gebruiker. Daarom maken
 * we de context aan op het moment dat je de timer start, niet pas bij nul.
 */
export function bereidGeluidVoor(): void {
  if (native()) return
  const AudioCtx = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtx) return
  geluid ??= new AudioCtx()
  void geluid.resume().catch(() => { /* geen geluid dan */ })
}

function piep(): void {
  const ctx = geluid
  if (!ctx) return
  for (let i = 0; i < 3; i++) {
    const osc = ctx.createOscillator()
    const volume = ctx.createGain()
    osc.frequency.value = 880
    osc.connect(volume)
    volume.connect(ctx.destination)
    const start = ctx.currentTime + i * 0.45
    volume.gain.setValueAtTime(0.3, start)
    volume.gain.exponentialRampToValueAtTime(0.001, start + 0.3)
    osc.start(start)
    osc.stop(start + 0.3)
  }
}
