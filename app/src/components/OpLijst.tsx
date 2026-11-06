import { useState } from 'react'
import { Dialoog } from './Dialoog'
import { useLijstActies } from '../lib/queries'
import { t } from '../lib/taal'

/** Wat we van een recept moeten weten om te beslissen of we eerst iets vragen. */
export interface LijstStatus {
  id: string
  titel: string
  gekozen: boolean
  opLijst: boolean
  aantal: number
}

/**
 * "Zet op de lijst", vanaf elk scherm hetzelfde gedrag.
 *
 * Staat het recept er al op, dan vragen we eerst of je het echt twee keer
 * wilt — een tweede tik is vaker een vergissing dan een plan. Staat het wel
 * in je week maar niet op de lijst, dan gaat het er gewoon op.
 *
 * Geeft een functie terug plus het dialoogelement; zet dat ergens in je scherm.
 */
export function useOpLijst(week?: string) {
  const { zetOpLijst, haalVanLijst } = useLijstActies(week)
  const [vraag, setVraag] = useState<LijstStatus | null>(null)

  function voegToe(recept: LijstStatus) {
    if (recept.opLijst) setVraag(recept)
    else zetOpLijst.mutate(recept.id)
  }

  const sluit = () => setVraag(null)
  const nogEens = vraag ? vraag.aantal + 1 : 2

  const dialoog = (
    <Dialoog
      open={Boolean(vraag)}
      kop={t('Staat al op je lijst')}
      tekst={vraag ? t('Heb je {titel} al op je lijst gezet? Wil je deze {n}x?', { titel: vraag.titel, n: nogEens }) : undefined}
      onSluit={sluit}
      acties={[
        { label: t('Ja, {n}x', { n: nogEens }), hoofd: true, onClick: () => { if (vraag) zetOpLijst.mutate(vraag.id); sluit() } },
        { label: t('Haal van mijn lijst'), onClick: () => { if (vraag) haalVanLijst.mutate(vraag.id); sluit() } },
        { label: t('Laat maar'), onClick: sluit },
      ]}
    />
  )

  return { voegToe, dialoog, bezig: zetOpLijst.isPending }
}
