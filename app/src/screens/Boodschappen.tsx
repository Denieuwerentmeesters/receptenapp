import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Checkbox, Icon } from '../ds'
import { Inhoud, Kop, Label, OnderBalk, Scherm, Titel, Voet } from '../components/Layout'
import { Fout, Grens, Leeg } from '../components/Staten'
import {
  useAhMapping, useBoodschapMuteren, useBoodschappen,
  useLijstSamenstellen, useVoorkeuren, useWeekmenu,
} from '../lib/queries'
import { bouwMandjeLink, openBijAh, zoekLink, zoekProduct } from '../lib/ah'
import { weekStart } from '../lib/week'
import type { BoodschapItem } from '../lib/database.types'

const SUGGESTIES = ['Koffie', 'Brood', 'Melk', 'Bananen', 'Wc-papier']

export function Boodschappen() {
  const week = weekStart()
  const navigeer = useNavigate()

  const boodschappen = useBoodschappen(week)
  const weekmenu = useWeekmenu(week)
  const voorkeuren = useVoorkeuren()
  const mapping = useAhMapping()
  const samenstellen = useLijstSamenstellen(week)
  const { afvinken, toevoegen, verwijderen } = useBoodschapMuteren(week)

  const [nieuw, setNieuw] = useState('')
  const [mandjeFout, setMandjeFout] = useState<string | null>(null)

  const gekozenRecepten = (weekmenu.data ?? []).filter((r) => r.gekozen)
  const items = useMemo(() => boodschappen.data ?? [], [boodschappen.data])
  const open = items.filter((i) => !i.is_afgevinkt)

  // Heb je recepten gekozen maar staat er nog niets op de lijst, dan vullen we
  // 'm één keer automatisch. Daarna is de lijst van jou: verwijderde items
  // komen niet terug.
  useEffect(() => {
    if (
      boodschappen.isSuccess && weekmenu.isSuccess &&
      items.length === 0 && gekozenRecepten.length > 0 &&
      samenstellen.isIdle
    ) {
      samenstellen.mutate()
    }
  }, [boodschappen.isSuccess, weekmenu.isSuccess, items.length, gekozenRecepten.length, samenstellen])

  const groepen = useMemo(() => groepeer(items), [items])

  async function naarMandje() {
    setMandjeFout(null)
    const { url, gemapt, ongemapt } = bouwMandjeLink(
      open, mapping.data ?? {}, voorkeuren.data?.biologisch_voorkeur ?? false,
    )
    if (gemapt.length === 0) {
      setMandjeFout(
        'Geen van deze producten heeft nog een AH-productnummer. Draai het mappingscript, ' +
        'of gebruik de zoeklinks hieronder.',
      )
      return
    }
    try {
      await openBijAh(url)
      // Bewust "doorgestuurd" en niet "staat in je mandje": we kunnen dat niet
      // controleren. AH voegt niets toe als je daar niet ingelogd bent, en geeft
      // dan geen foutmelding — je ziet alleen een leeg mandje.
      setMandjeFout(
        `${gemapt.length} product${gemapt.length === 1 ? '' : 'en'} doorgestuurd naar Albert Heijn. ` +
        (ongemapt.length > 0
          ? `${ongemapt.length} nog niet — die hebben nog geen productnummer. `
          : '') +
        'Zie je een leeg mandje? Dan ben je bij AH niet ingelogd; log daar in en tik opnieuw.',
      )
    } catch {
      setMandjeFout('Het mandje is niet aangekomen. Je lijst is bewaard — er is niets kwijt.')
    }
  }

  if (mandjeFout && open.length > 0 && !mandjeFout.includes('doorgestuurd')) {
    return (
      <Fout
        kop="Je mandje is niet aangekomen"
        tekst={mandjeFout}
        stappen={[
          'Log eerst in bij Albert Heijn — uitgelogd voegt AH niets toe, zonder melding.',
          'Probeer het daarna opnieuw.',
          'Lukt het niet? Vink de lijst zelf af in de winkel.',
        ]}
        onOpnieuw={() => { void naarMandje() }}
        onTerug={() => setMandjeFout(null)}
      />
    )
  }

  return (
    <Scherm>
      <Grens query={boodschappen} ladenTekst="Boodschappenlijst ophalen">
        <Kop kleur="var(--c-green)">
          <Label>{gekozenRecepten.length} {gekozenRecepten.length === 1 ? 'recept' : 'recepten'}</Label>
          <div style={{ marginTop: 14 }}><Titel>Boodschappen</Titel></div>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.5, margin: '10px 0 0' }}>
            {items.length === 0
              ? 'Nog niets op je lijst.'
              : `${open.length} van de ${items.length} producten nog nodig · dubbele ingrediënten samengevoegd`}
          </p>
        </Kop>

        {items.length === 0 ? (
          <Leeg
            icoon="cart"
            kop="Je lijst is leeg"
            tekst="Kies een recept, dan zetten we de ingrediënten er automatisch bij."
            knop="Naar mijn weekmenu"
            onKnop={() => navigeer('/weekmenu')}
          />
        ) : (
          <Inhoud style={{ gap: 18 }}>
            {mandjeFout && (
              <div style={{
                background: 'var(--c-warm-300)', borderRadius: 'var(--radius-sm)', padding: '12px 14px',
                fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.4,
              }}>{mandjeFout}</div>
            )}

            {groepen.map((groep) => (
              <div key={groep.naam} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', paddingBottom: 6 }}>
                  <span style={{
                    fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, letterSpacing: '.1em',
                    textTransform: 'uppercase', color: 'var(--c-green)',
                  }}>{groep.naam}</span>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, color: 'rgba(20,20,20,0.6)' }}>
                    {groep.items.filter((i) => !i.is_afgevinkt).length} van {groep.items.length}
                  </span>
                </div>

                {groep.items.map((item) => (
                  <div key={item.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 2px',
                    borderBottom: '1.5px solid rgba(20,20,20,0.12)',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Checkbox
                        checked={item.is_afgevinkt}
                        onChange={() => afvinken.mutate({ itemId: item.id, afgevinkt: !item.is_afgevinkt })}
                      >
                        {labelVan(item)}
                      </Checkbox>
                    </div>
                    {!zoekProduct(item, mapping.data ?? {}) && (
                      <a
                        href={zoekLink(item.naam)}
                        onClick={(e) => { e.preventDefault(); void openBijAh(zoekLink(item.naam)) }}
                        style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}
                      >zoek</a>
                    )}
                    <button
                      onClick={() => verwijderen.mutate(item.id)}
                      aria-label={`${item.naam} verwijderen`}
                      style={{
                        flex: 'none', width: 28, height: 28, borderRadius: 'var(--radius-full)',
                        border: 'none', background: 'transparent', color: 'rgba(20,20,20,0.45)',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    ><Icon name="x" size={14} /></button>
                  </div>
                ))}
              </div>
            ))}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 8 }}>
              <span style={{
                fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, letterSpacing: '.1em',
                textTransform: 'uppercase', color: 'var(--c-green)',
              }}>Zelf toevoegen</span>

              <form
                onSubmit={(e) => { e.preventDefault(); toevoegen.mutate(nieuw); setNieuw('') }}
                style={{ display: 'flex', gap: 8 }}
              >
                <input
                  value={nieuw}
                  onChange={(e) => setNieuw(e.target.value)}
                  placeholder="Bijv. koffiebonen"
                  style={{
                    flex: 1, minWidth: 0, background: 'var(--c-paper)',
                    border: '1.5px solid rgba(20,20,20,0.14)', borderRadius: 14,
                    padding: '13px 15px', fontFamily: 'var(--font-body)', fontSize: 15,
                  }}
                />
                <button type="submit" style={{
                  flex: 'none', border: 'none', borderRadius: 14, padding: '0 18px',
                  background: 'var(--c-red)', color: 'var(--c-cream)',
                  fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                }}>Toevoegen</button>
              </form>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {SUGGESTIES
                  .filter((s) => !items.some((i) => i.naam.toLowerCase() === s.toLowerCase()))
                  .slice(0, 4)
                  .map((s) => (
                    <button key={s} onClick={() => toevoegen.mutate(s)} style={{
                      border: '1.5px solid rgba(20,20,20,0.14)', background: 'transparent',
                      borderRadius: 'var(--radius-full)', padding: '8px 14px',
                      fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    }}>+ {s}</button>
                  ))}
              </div>
            </div>
          </Inhoud>
        )}

        {items.length > 0 && (
          <Voet>
            <Button
              disabled={open.length === 0}
              onClick={() => { void naarMandje() }}
              style={{ width: '100%', padding: '17px 24px', fontSize: 16 }}
            >
              {open.length === 0 ? 'Alles al in huis' : `Naar AH-mandje (${open.length})`}
            </Button>
            <p style={{
              fontFamily: 'var(--font-body)', fontSize: 12, lineHeight: 1.4, margin: '8px 0 0',
              textAlign: 'center', color: 'rgba(20,20,20,0.6)',
            }}>Afgevinkte producten laten we uit je mandje.</p>
          </Voet>
        )}
      </Grens>

      <OnderBalk />
    </Scherm>
  )
}

function labelVan(item: BoodschapItem): string {
  const hoeveelheid = item.hoeveelheid === null
    ? ''
    : `${String(item.hoeveelheid).replace('.', ',')} ${item.eenheid ?? ''} `.replace(/\s+/g, ' ')
  return `${hoeveelheid}${item.naam.toLowerCase()}`.trim()
}

/** Afgevinkte items zakken naar onderen, zodat je bovenaan ziet wat je nog moet halen. */
function groepeer(items: BoodschapItem[]) {
  const perCategorie = new Map<string, BoodschapItem[]>()
  for (const item of items) {
    const naam = item.categorie ?? 'Uit je recepten'
    const rij = perCategorie.get(naam) ?? []
    rij.push(item)
    perCategorie.set(naam, rij)
  }
  return [...perCategorie].map(([naam, rij]) => ({
    naam,
    items: [...rij].sort((a, b) => Number(a.is_afgevinkt) - Number(b.is_afgevinkt)),
  }))
}
