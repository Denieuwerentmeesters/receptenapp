/** Maandag van de week waarin `datum` valt, als YYYY-MM-DD. Spiegel van public.week_start. */
export function weekStart(datum = new Date()): string {
  const d = new Date(datum)
  const dag = (d.getDay() + 6) % 7 // maandag = 0
  d.setDate(d.getDate() - dag)
  return d.toISOString().slice(0, 10)
}

const MAANDEN = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']

/** "12 aug" — zoals in de designs boven het weekmenu. */
export function weekLabel(weekStartDatum: string): string {
  const d = new Date(`${weekStartDatum}T00:00:00`)
  return `${d.getDate()} ${MAANDEN[d.getMonth()]}`
}
