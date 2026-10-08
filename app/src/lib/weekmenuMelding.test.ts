import { describe, expect, it } from 'vitest'
import { meldingMoment } from './weekmenuMelding'

describe('meldingMoment', () => {
  it('zet dag 0 (zondag) om naar weekday 1 en leest de tijd', () => {
    expect(meldingMoment({ pushbericht_aan: true, pushbericht_dag: 0, pushbericht_tijd: '17:00:00' }))
      .toEqual({ weekday: 1, hour: 17, minute: 0 })
    expect(meldingMoment({ pushbericht_aan: true, pushbericht_dag: 6, pushbericht_tijd: '09:30' }))
      .toEqual({ weekday: 7, hour: 9, minute: 30 })
  })
  it('geeft null als de melding uit staat of de instelling niet klopt', () => {
    expect(meldingMoment({ pushbericht_aan: false, pushbericht_dag: 0, pushbericht_tijd: '17:00:00' })).toBeNull()
    expect(meldingMoment({ pushbericht_aan: true, pushbericht_dag: 7, pushbericht_tijd: '17:00:00' })).toBeNull()
    expect(meldingMoment({ pushbericht_aan: true, pushbericht_dag: 1, pushbericht_tijd: 'straks' })).toBeNull()
  })
})
