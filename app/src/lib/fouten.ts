/**
 * Haalt een leesbare melding uit wat een laag ook maar teruggeeft.
 *
 * PostgREST geeft geen Error maar een gewoon object met message/details/hint/code.
 * Zonder deze functie viel de app terug op "Onbekende fout" en was er niets te
 * debuggen — precies op het moment dat je de melding het hardst nodig hebt.
 */
export function foutTekst(fout: unknown): string {
  if (typeof fout === 'string') return fout
  if (fout instanceof Error) return fout.message

  if (fout && typeof fout === 'object') {
    const o = fout as Record<string, unknown>
    const delen = [o.message, o.details, o.hint]
      .filter((d): d is string => typeof d === 'string' && d.length > 0)

    if (delen.length > 0) {
      const code = typeof o.code === 'string' ? ` (${o.code})` : ''
      return delen.join(' — ') + code
    }

    try {
      return JSON.stringify(fout)
    } catch {
      /* valt door naar de standaardtekst */
    }
  }

  return 'Onbekende fout.'
}
