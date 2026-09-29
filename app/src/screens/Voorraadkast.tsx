import { useState } from 'react'
import { Icon } from '../ds'
import { Inhoud, Kop, Label, Scherm, TerugKnop, Titel, Voet } from '../components/Layout'
import { Grens, Leeg } from '../components/Staten'
import { Dialoog } from '../components/Dialoog'
import { useVoorraad, useVoorraadMuteren, type VoorraadItem } from '../lib/queries2'
import { DROGE_KRUIDEN, DROGE_KRUIDEN_KEY, DROGE_KRUIDEN_UITLEG } from '../lib/kruiden'
import { ingredientKey } from '../lib/schaal'

/**
 * Wat de meeste mensen standaard in huis hebben. We tonen er steeds een paar;
 * voeg je er een toe, dan schuift de volgende door. Zout, peper, suiker en
 * bouillon staan er niet bij: die komen sowieso nooit op de lijst (altijdInHuis).
 */
const SUGGESTIES = [
  DROGE_KRUIDEN, 'Olijfolie', 'Uien', 'Knoflook', 'Rijst', 'Pasta', 'Eieren', 'Boter',
  'Zonnebloemolie', 'Bloem', 'Sojasaus', 'Tomatenpuree', 'Mosterd', 'Honing', 'Azijn',
  'Balsamicoazijn', 'Ketjap', 'Sambal', 'Maizena', 'Melk', 'Parmezaan', 'Paneermeel',
  'Couscous', 'Passata', 'Kokosmelk', 'Mayonaise',
]
const ZICHTBAAR = 8

/**
 * Wat je in huis hebt. Staat een ingrediënt hier aan, dan valt het van je
 * boodschappenlijst af — dat scheelt de derde fles olijfolie.
 */
export function Voorraadkast() {
  const voorraad = useVoorraad()
  const { toggle, toevoegen, verwijderen } = useVoorraadMuteren()
  const [nieuw, setNieuw] = useState('')
  const [kruidenUitleg, setKruidenUitleg] = useState(false)

  const items = voorraad.data ?? []
  const inHuis = items.filter((i) => i.in_huis).length
  const groepen = groepeer(items)
  const inKast = new Set(items.map((i) => i.ingredient_key))
  const suggesties = SUGGESTIES.filter((s) => !inKast.has(ingredientKey(s))).slice(0, ZICHTBAAR)

  function voegToe(naam: string) {
    if (!naam.trim()) return
    toevoegen.mutate(naam)
    if (ingredientKey(naam) === DROGE_KRUIDEN_KEY) setKruidenUitleg(true)
  }

  const suggestieKnoppen = suggesties.length > 0 && (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: items.length === 0 ? 'center' : 'flex-start' }}>
      {suggesties.map((s) => (
        <button key={s} onClick={() => voegToe(s)} style={{
          border: '1.5px solid rgba(20,20,20,0.14)', background: 'transparent',
          borderRadius: 'var(--radius-full)', padding: '8px 14px',
          fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
        }}>+ {s}</button>
      ))}
    </div>
  )

  return (
    <Scherm>
      <Grens query={voorraad} ladenTekst="Voorraadkast ophalen">
        <Kop kleur="var(--c-gold)" tekstKleur="var(--c-ink)" style={{ paddingBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <TerugKnop donker />
            <Label kleur="var(--c-green)">In huis</Label>
          </div>
          <div style={{ marginTop: 14 }}><Titel grootte={26}>Voorraadkast</Titel></div>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.5, margin: '10px 0 0' }}>
            Wat hier aan staat, laten we van je boodschappenlijst af.
          </p>
        </Kop>

        <Inhoud style={{ gap: 18 }}>
          <form
            onSubmit={(e) => { e.preventDefault(); voegToe(nieuw); setNieuw('') }}
            style={{ display: 'flex', gap: 8 }}
          >
            <input
              value={nieuw}
              onChange={(e) => setNieuw(e.target.value)}
              placeholder="Voeg iets toe dat je in huis hebt"
              style={{
                flex: 1, minWidth: 0, background: 'var(--c-paper)',
                border: '1.5px solid rgba(20,20,20,0.14)', borderRadius: 14,
                padding: '13px 15px', fontFamily: 'var(--font-body)', fontSize: 16,
              }}
            />
            <button type="submit" style={{
              flex: 'none', border: 'none', borderRadius: 14, padding: '0 18px',
              background: 'var(--c-red)', color: 'var(--c-cream)',
              fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}>Toevoegen</button>
          </form>

          {items.length === 0 ? (
            <>
              <Leeg
                icoon="list"
                kop="Je kast is nog leeg"
                tekst="Voeg toe wat je standaard in huis hebt. Die producten laten we dan van je lijst af."
              />
              {suggestieKnoppen}
            </>
          ) : (
            <>
            {groepen.map((groep) => (
              <div key={groep.naam} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', paddingBottom: 6 }}>
                  <span style={{
                    fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, letterSpacing: '.1em',
                    textTransform: 'uppercase', color: 'var(--c-red)',
                  }}>{groep.naam}</span>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, color: 'rgba(20,20,20,0.6)' }}>
                    {groep.items.filter((i) => i.in_huis).length} van {groep.items.length}
                  </span>
                </div>

                {groep.items.map((item) => (
                  <div key={item.ingredient_key} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '11px 2px',
                    borderBottom: '1.5px solid rgba(20,20,20,0.12)',
                  }}>
                    <span style={{
                      flex: 1, minWidth: 0, fontFamily: 'var(--font-body)', fontSize: 15,
                      color: item.in_huis ? 'var(--color-ink)' : 'rgba(20,20,20,0.45)',
                    }}>
                      {item.naam}
                      {item.ingredient_key === DROGE_KRUIDEN_KEY && (
                        <span style={{ display: 'block', fontSize: 12, marginTop: 2, color: 'rgba(20,20,20,0.6)' }}>
                          {item.in_huis ? 'Wel op je lijst, niet in je mandje' : 'Gaan weer mee naar je mandje'}
                        </span>
                      )}
                    </span>

                    <button
                      onClick={() => toggle.mutate({ key: item.ingredient_key, inHuis: !item.in_huis })}
                      style={{
                        flex: 'none', borderRadius: 'var(--radius-full)', padding: '8px 14px', cursor: 'pointer',
                        border: item.in_huis ? 'none' : '1.5px solid rgba(20,20,20,0.18)',
                        background: item.in_huis ? 'var(--c-red)' : 'transparent',
                        color: item.in_huis ? 'var(--c-cream)' : 'rgba(20,20,20,0.6)',
                        fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700,
                      }}
                    >{item.in_huis ? 'in huis' : 'op'}</button>

                    <button
                      onClick={() => verwijderen.mutate(item.ingredient_key)}
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

            {suggesties.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span style={{
                  fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, letterSpacing: '.1em',
                  textTransform: 'uppercase', color: 'var(--c-red)',
                }}>Snel toevoegen</span>
                {suggestieKnoppen}
              </div>
            )}
            </>
          )}
        </Inhoud>

        {items.length > 0 && (
          <Voet>
            <p style={{
              fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: 1.4, margin: 0,
              textAlign: 'center', color: 'rgba(20,20,20,0.6)',
            }}>
              {inHuis} {inHuis === 1 ? 'product' : 'producten'} in huis · deze laten we van je lijst af
            </p>
          </Voet>
        )}
      </Grens>

      <Dialoog
        open={kruidenUitleg}
        kop="Droge kruiden in huis"
        tekst={`${DROGE_KRUIDEN_UITLEG} Ze blijven op je boodschappenlijst staan, zodat je ziet wat een recept vraagt, maar we zetten ze niet meer in je mandje.`}
        onSluit={() => setKruidenUitleg(false)}
        acties={[{ label: 'Begrepen', hoofd: true, onClick: () => setKruidenUitleg(false) }]}
      />
    </Scherm>
  )
}

function groepeer(items: VoorraadItem[]) {
  const perCategorie = new Map<string, VoorraadItem[]>()
  for (const item of items) {
    const naam = item.categorie ?? 'Overig'
    perCategorie.set(naam, [...(perCategorie.get(naam) ?? []), item])
  }
  return [...perCategorie].map(([naam, items]) => ({ naam, items }))
}
