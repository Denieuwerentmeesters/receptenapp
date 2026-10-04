import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Chip, Icon, IconButton } from '../ds'
import { Inhoud, Kop, Label, Scherm, TerugKnop, Titel, Voet } from '../components/Layout'
import { useQueryClient } from '@tanstack/react-query'
import { Dialoog } from '../components/Dialoog'
import { useAhMapping, useDezeWeek, useJumboMapping, useLijstActies, useVoorkeuren } from '../lib/queries'
import { allergeenNaam, opsomming, receptAllergie, useAllergeenRegels, useAllergieen } from '../lib/allergenen'
import { altijdInHuis } from '../lib/altijdInHuis'
import { euro } from '../lib/besparing'
import { foutTekst } from '../lib/fouten'
import { ingredientKey } from '../lib/schaal'
import { zoekProduct } from '../lib/zoekProduct'
import {
  KEUKEN_KEUZES, MAX_PERSONEN, MAX_WENSEN, menuNaam,
  type Menu, type MenuGerecht, type SamenstelVerzoek,
} from '../lib/menu'
import {
  maakFotos, receptenVanMenu, stelSamen, useMenuKosten, useEerdereMenus, useMenuOpslaan, type EerderMenu,
} from '../lib/samenstellen'
import type { Ingredient } from '../lib/database.types'

/** Zelfde perzik als Ontdekken: daar kom je vandaan. */
const ACHTERGROND = '#FCD6C3'

const WENS_KEUZES = ['vegetarisch', 'niet te duur', 'snel klaar', 'kindvriendelijk', 'zonder noten']
const BIJSTUREN = ['Goedkoper', 'Iets vegetarisch erbij', 'Minder pittig']

type Fase = 'vragen' | 'bezig' | 'menu'

const OPSLAG = 'pinch-samenstellen'

interface Onthouden {
  keuken: string | null
  personen: number | null
  wensen: string
  menu: Menu | null
  samenstellingId: string | null
  /** De recept-id's zodra het menu is opgeslagen, in de volgorde van het menu. */
  receptIds: string[] | null
  opLijst: boolean
}

/**
 * Wat je aan het samenstellen was. Bewaard op het toestel: open je een recept
 * of de lijst, of herlaad je de pagina, dan staat je menu er nog. Is het toch
 * weg, dan staat het bij "Eerdere menu's".
 */
function leesOnthouden(): Onthouden {
  const leeg: Onthouden = {
    keuken: null, personen: null, wensen: '', menu: null, samenstellingId: null, receptIds: null, opLijst: false,
  }
  try {
    const ruw = JSON.parse(localStorage.getItem(OPSLAG) ?? 'null') as Partial<Onthouden> | null
    // Een menu dat halverwege het schrijven bleef steken is niets om naar terug te keren.
    return ruw && typeof ruw === 'object'
      ? { ...leeg, ...ruw, menu: ruw.menu && ruw.menu.gerechten?.length > 0 && ruw.samenstellingId ? ruw.menu : null }
      : leeg
  } catch {
    return leeg
  }
}

const onthouden = leesOnthouden()

/**
 * Stel je eigen menu samen: drie vragen, daarna maakt Claude de recepten.
 *
 * De gerechten verschijnen één voor één. Er wordt niets opgeslagen tot je het
 * menu op je lijst zet of de recepten bewaart; tot dan kun je een gerecht
 * laten vervangen of het hele menu bijsturen.
 */
export function Samenstellen() {
  const navigeer = useNavigate()
  const voorkeuren = useVoorkeuren()
  const allergieen = useAllergieen()
  const regels = useAllergeenRegels(allergieen.length > 0)
  const winkelId = voorkeuren.data?.voorkeurswinkel ?? 'ah'
  const ah = useAhMapping(winkelId === 'ah')
  const jumbo = useJumboMapping(winkelId === 'jumbo')
  // Alleen óf er een product is doet er hier toe, niet welk.
  const mapping: Record<string, unknown> | undefined = winkelId === 'jumbo' ? jumbo.data : ah.data
  const opslaan = useMenuOpslaan()
  const eerdere = useEerdereMenus()
  const dezeWeek = useDezeWeek()
  const qc = useQueryClient()
  const { zetOpLijst } = useLijstActies()

  const [fase, setFase] = useState<Fase>(onthouden.menu ? 'menu' : 'vragen')
  const [keuken, setKeuken] = useState(onthouden.keuken)
  const [personenKeuze, setPersonen] = useState(onthouden.personen)
  const personen = personenKeuze ?? voorkeuren.data?.aantal_personen ?? 4
  const [wensen, setWensen] = useState(onthouden.wensen)
  const [menu, setMenu] = useState(onthouden.menu)
  const [samenstellingId, setSamenstellingId] = useState(onthouden.samenstellingId)
  const [receptIds, setReceptIds] = useState(onthouden.receptIds)
  const [opLijst, setOpLijst] = useState(onthouden.opLijst)
  // Wat er onderweg is: 'menu' = het hele menu, een getal = dat ene gerecht.
  const [onderweg, setOnderweg] = useState<'menu' | number | null>(null)
  const [open, setOpen] = useState<number | null>(null)
  // Hoeveel gerechten er komen, zodra Claude dat weet: zoveel lege kaarten.
  const [verwacht, setVerwacht] = useState(0)
  const [wijziging, setWijziging] = useState('')
  const [fout, setFout] = useState('')
  const [bewaren, setBewaren] = useState(false)
  const [eerdereOpen, setEerdereOpen] = useState(false)
  const [zoekEerder, setZoekEerder] = useState('')

  useEffect(() => {
    Object.assign(onthouden, { keuken, personen: personenKeuze, wensen, menu, samenstellingId, receptIds, opLijst })
    try { localStorage.setItem(OPSLAG, JSON.stringify(onthouden)) } catch { /* geen opslag: dan alleen in het geheugen */ }
  }, [keuken, personenKeuze, wensen, menu, samenstellingId, receptIds, opLijst])

  // Ga je weg terwijl Claude nog schrijft, dan hoeft het antwoord niet meer.
  const lopend = useRef<AbortController | null>(null)
  useEffect(() => () => lopend.current?.abort(), [])

  async function vraagAan(extra: Pick<SamenstelVerzoek, 'vorig' | 'wijziging' | 'vervang'>) {
    if (!keuken) return
    lopend.current?.abort()
    const controller = new AbortController()
    lopend.current = controller
    setFout('')
    setOnderweg(extra.vervang ?? 'menu')
    const nieuw = !extra.vorig
    if (nieuw) {
      setMenu({ keuken, personen, begrepen: [], gerechten: [], draaiboek: [], opmerking: null })
      setReceptIds(null); setOpLijst(false); setOpen(null); setVerwacht(0)
      setFase('bezig')
    }
    try {
      const uitkomst = await stelSamen(
        { keuken, personen, wensen: wensen.trim(), allergieen, winkel: winkelId, ...extra },
        (g) => {
          // Bij bijsturen blijft het oude menu staan tot het nieuwe af is.
          if (!nieuw) return
          if (g.soort === 'kop') {
            setVerwacht(g.aantal)
            setMenu((m) => m && { ...m, keuken: g.keuken, begrepen: g.begrepen })
          }
          if (g.soort === 'gerecht') setMenu((m) => m && { ...m, gerechten: [...m.gerechten, g.gerecht] })
        },
        controller.signal,
      )
      setMenu(uitkomst.menu)
      setSamenstellingId(uitkomst.samenstellingId)
      void qc.invalidateQueries({ queryKey: ['eerdere-menus'] })
      setWijziging('')
      setFase('menu')
    } catch (e) {
      if (controller.signal.aborted) return
      setFout(foutTekst(e))
      if (nieuw) { setMenu(null); setFase('vragen') }
    } finally {
      if (lopend.current === controller) { lopend.current = null; setOnderweg(null) }
    }
  }

  /** Slaat de recepten op (één keer) en zet ze desgewenst op de lijst. */
  async function bewaar(naarLijst: boolean) {
    if (!menu) return
    setFout(''); setBewaren(true)
    try {
      const ids = receptIds ?? await opslaan.mutateAsync({ menu, samenstellingId, bewaar: !naarLijst })
      setReceptIds(ids)
      if (naarLijst) {
        for (const id of ids) await zetOpLijst.mutateAsync(id)
        setOpLijst(true)
        navigeer('/boodschappen')
      }
    } catch (e) {
      setFout(foutTekst(e))
    } finally {
      setBewaren(false)
    }
  }

  function opnieuw() {
    lopend.current?.abort()
    setMenu(null); setSamenstellingId(null); setReceptIds(null); setOpLijst(false)
    setOnderweg(null); setFout(''); setFase('vragen')
  }

  /** Haalt een eerder menu terug, met de recepten die er toen bij zijn opgeslagen. */
  async function haalTerug(eerder: EerderMenu) {
    lopend.current?.abort()
    setEerdereOpen(false); setFout('')
    try {
      const ids = await receptenVanMenu(eerder.id)
      const opDeLijst = new Set((dezeWeek.data ?? []).filter((r) => r.opLijst).map((r) => r.id))
      setKeuken(eerder.menu.keuken); setPersonen(eerder.menu.personen)
      setWensen(eerder.aangepast ? '' : eerder.wensen)
      setMenu(eerder.menu); setSamenstellingId(eerder.id)
      setReceptIds(ids.length > 0 ? ids : null)
      // Opgeslagen vóór de foto's meteen gemaakt werden, of toen mislukt: alsnog.
      if (ids.length > 0) {
        void maakFotos(eerder.id).then((gelukt) => {
          if (gelukt > 0) for (const sleutel of ['deze-week', 'recept', 'favorieten']) void qc.invalidateQueries({ queryKey: [sleutel] })
        })
      }
      setOpLijst(ids.length > 0 && ids.every((id) => opDeLijst.has(id)))
      setOnderweg(null); setOpen(null); setFase('menu')
    } catch (e) {
      setFout(foutTekst(e))
    }
  }

  const gevondenEerdere = useMemo(() => {
    const term = zoekEerder.trim().toLowerCase()
    const alle = eerdere.data ?? []
    if (!term) return alle
    return alle.filter((e) => [
      menuNaam(e.menu), e.wensen, datumTekst(e.aangemaaktOp), datumCijfers(e.aangemaaktOp),
      ...e.menu.gerechten.map((g) => g.titel),
    ].join(' ').toLowerCase().includes(term))
  }, [eerdere.data, zoekEerder])

  /** "Wis recepten": het menu en de drie antwoorden weg, terug naar een leeg vragenscherm. */
  function wis() {
    opnieuw()
    setKeuken(null); setPersonen(null); setWensen(''); setWijziging(''); setOpen(null)
  }

  // Wat straks als zoeklink gaat in plaats van als product in je mandje. Pas
  // tellen als de mapping er is: anders lijkt even alles een zoeklink.
  const zoek = useMemo(() => {
    const namen = new Set<string>()
    if (!menu || !mapping) return namen
    for (const gerecht of menu.gerechten) {
      for (const ing of gerecht.ingredienten) {
        const key = ingredientKey(ing.naam)
        if (!key || altijdInHuis(key)) continue
        if (!zoekProduct({ ingredient_key: key, naam: ing.naam }, mapping)) namen.add(ing.naam)
      }
    }
    return namen
  }, [menu, mapping])
  // Samengevoegd zoals op de lijst: citroen uit drie gerechten is één product.
  const { producten, kosten, inHuis } = useMenuKosten(menu)

  if (fase === 'vragen' || !menu) {
    return (
      <Scherm>
        <Kop kleur="var(--c-orange)" tekstKleur="var(--c-paper)" style={{ paddingBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <TerugKnop anders="/ontdekken" />
            <Titel grootte={22}>Stel je eigen menu samen</Titel>
          </div>
        </Kop>
        <Inhoud style={{ gap: 10 }}>
          <p style={LEAD}>Drie vragen, daarna maakt Pinch de recepten en zet de boodschappen klaar.</p>
          {(eerdere.data?.length ?? 0) > 0 && (
            <div>
              <Chip onClick={() => setEerdereOpen(true)}>Eerdere menu's ({eerdere.data!.length}) ▾</Chip>
            </div>
          )}

          <Vraag nummer={1} tekst="Welke keuken?" />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {KEUKEN_KEUZES.map((k) => (
              <Chip key={k} selected={keuken === k} onClick={() => setKeuken(k)}>{k}</Chip>
            ))}
          </div>

          <Vraag nummer={2} tekst="Voor hoeveel personen?" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <IconButton
              icon="minus" label="Minder personen" size={44}
              onClick={() => setPersonen(Math.max(1, personen - 1))}
              style={{ background: 'var(--c-paper)', color: 'var(--c-ink)', border: '1.5px solid var(--c-ink)' }}
            />
            <output aria-live="polite" style={{
              fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 26, minWidth: 44,
              textAlign: 'center', fontVariantNumeric: 'tabular-nums',
            }}>{personen}</output>
            <IconButton
              icon="plus" label="Meer personen" size={44}
              onClick={() => setPersonen(Math.min(MAX_PERSONEN, personen + 1))}
              style={{ background: 'var(--c-paper)', color: 'var(--c-ink)', border: '1.5px solid var(--c-ink)' }}
            />
            <span style={{ ...KLEIN, fontSize: 14 }}>{personen === 1 ? 'persoon' : 'personen'}</span>
          </div>

          <Vraag nummer={3} tekst="Nog wensen?" bij="mag leeg blijven" />
          <textarea
            value={wensen}
            maxLength={MAX_WENSEN}
            onChange={(e) => setWensen(e.target.value)}
            aria-label="Wensen"
            placeholder="Bijvoorbeeld vegetarisch, keto, niet te duur, een allergie, of een salade en iets met vis"
            style={{
              width: '100%', minHeight: 96, resize: 'none', boxSizing: 'border-box',
              border: '2px solid var(--c-ink)', borderRadius: 16, padding: 14,
              // 16 px: kleiner en iOS Safari zoomt in zodra je het veld aantikt.
              fontFamily: 'var(--font-body)', fontSize: 16, lineHeight: 1.4,
              background: 'var(--c-paper)', color: 'var(--color-ink)',
            }}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {WENS_KEUZES.map((w) => (
              <Chip key={w} onClick={() => {
                if (wensen.toLowerCase().includes(w)) return
                const basis = wensen.trim().replace(/[,.]$/, '')
                setWensen((basis ? `${basis}, ${w}` : w).slice(0, MAX_WENSEN))
              }}>+ {w}</Chip>
            ))}
          </div>
          {allergieen.length > 0 && (
            <p style={KLEIN}>Je allergie-instelling geldt ook hier: zonder {opsomming(allergieen)}.</p>
          )}
          {fout && <Melding>{fout}</Melding>}
        </Inhoud>
        <Dialoog
          open={eerdereOpen}
          kop="Eerdere menu's"
          tekst="Alles wat je liet samenstellen, nieuwste eerst. Tik er een aan om 'm terug te halen."
          acties={[{ label: 'Sluiten', onClick: () => setEerdereOpen(false) }]}
          onSluit={() => setEerdereOpen(false)}
        >
          <input
            value={zoekEerder}
            onChange={(e) => setZoekEerder(e.target.value)}
            aria-label="Zoek in eerdere menu's"
            placeholder="Zoek op datum, keuken of gerecht"
            style={{
              border: '1.5px solid var(--c-ink)', borderRadius: 'var(--radius-full)', padding: '10px 14px',
              fontFamily: 'var(--font-body)', fontSize: 16, background: 'var(--c-paper)', color: 'var(--color-ink)',
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '45dvh', overflowY: 'auto' }}>
            {gevondenEerdere.length === 0 && <p style={{ ...KLEIN, padding: '12px 2px' }}>Niets gevonden.</p>}
            {gevondenEerdere.map((e) => (
              <button key={e.id} onClick={() => void haalTerug(e)} style={{
                display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'left', cursor: 'pointer',
                background: 'none', border: 'none', borderBottom: '1.5px solid rgba(20,20,20,0.12)',
                padding: '11px 2px', fontFamily: 'var(--font-body)', color: 'var(--color-ink)',
              }}>
                <span style={{ fontSize: 16, fontWeight: 700 }}>
                  {menuNaam(e.menu)} <span style={{ fontWeight: 500, color: 'rgba(20,20,20,0.6)' }}>· {datumTekst(e.aangemaaktOp)}</span>
                </span>
                <span style={KLEIN}>{e.menu.gerechten.map((g) => g.titel).join(' · ')}</span>
                {e.wensen && <span style={{ ...KLEIN, fontStyle: 'italic' }}>{e.aangepast ? 'Aangepast: ' : ''}“{e.wensen}”</span>}
              </button>
            ))}
          </div>
        </Dialoog>
        <Voet>
          <Button
            disabled={!keuken}
            onClick={() => void vraagAan({})}
            style={{ width: '100%', padding: '17px 24px' }}
          >{keuken ? 'Stel samen' : 'Kies eerst een keuken'}</Button>
        </Voet>
      </Scherm>
    )
  }

  const bezig = fase === 'bezig'
  const vast = receptIds !== null
  const labels = [
    `${menu.personen} ${menu.personen === 1 ? 'persoon' : 'personen'}`,
    // Het aantal personen en gerechten tellen we zelf; anders staat het er dubbel.
    ...menu.begrepen.filter((b) => !/^\d+\s+(gerecht|gang|perso)/i.test(b)),
    ...(bezig ? [] : [`${menu.gerechten.length} ${menu.gerechten.length === 1 ? 'gerecht' : 'gerechten'}`]),
  ]

  return (
    <Scherm achtergrond={ACHTERGROND}>
      <Kop kleur="var(--c-ink)" tekstKleur="var(--c-cream)" style={{ paddingBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <button onClick={vast ? opnieuw : () => { lopend.current?.abort(); setOnderweg(null); setFase('vragen') }} style={{
            background: 'none', border: 'none', color: 'var(--c-cream)', cursor: 'pointer', padding: '4px 0',
            display: 'flex', alignItems: 'center', gap: 6,
            fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700,
          }}>
            <Icon name="chevronLeft" size={16} />{vast ? 'Nieuw menu' : 'Vragen aanpassen'}
          </button>
          {/* Weg ermee en opnieuw beginnen. Wat al op je lijst of bij je favorieten staat blijft daar. */}
          <button onClick={wis} style={{
            flex: 'none', border: '1.5px solid rgba(255,246,232,0.5)', borderRadius: 'var(--radius-full)',
            background: 'transparent', color: 'var(--c-cream)', cursor: 'pointer', padding: '6px 12px',
            display: 'flex', alignItems: 'center', gap: 6,
            fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700,
          }}>
            <Icon name="trash" size={14} />Wis recepten
          </button>
        </div>
        <Titel grootte={22}>{menuNaam(menu)}</Titel>
        {wensen.trim() && (
          <p style={{
            fontFamily: 'var(--font-body)', fontSize: 13, fontStyle: 'italic', margin: '10px 0 0',
            color: 'rgba(255,246,232,0.75)', display: '-webkit-box', WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>“{wensen.trim()}”</p>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
          {labels.map((l) => (
            <span key={l} style={{
              fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, padding: '5px 10px',
              borderRadius: 'var(--radius-full)', background: 'var(--c-yellow)', color: 'var(--c-ink)',
            }}>{l}</span>
          ))}
        </div>
      </Kop>

      <Inhoud>
        {menu.opmerking && !bezig && <Melding toon="rustig">{menu.opmerking}</Melding>}

        {menu.gerechten.map((gerecht, i) => (
          <GerechtKaart
            key={`${i}-${gerecht.titel}`}
            gerecht={gerecht}
            personen={menu.personen}
            open={open === i}
            bezig={onderweg === i || (onderweg === 'menu' && !bezig)}
            bevat={allergieen.length > 0 && regels.data
              ? receptAllergie(gerecht.ingredienten.map((ing) => ing.naam), regels.data, allergieen).bevat : []}
            zoek={zoek}
            receptId={receptIds?.[i]}
            onOpen={() => setOpen(open === i ? null : i)}
            onAnder={bezig || vast || onderweg !== null ? undefined : () => void vraagAan({ vorig: menu, vervang: i })}
            onRecept={(id) => navigeer(`/recept/${id}`)}
          />
        ))}

        {bezig && (
          <>
            {Array.from({ length: Math.max(1, verwacht - menu.gerechten.length) }, (_, i) => <Skelet key={i} />)}
            <p style={KLEIN}>
              Pinch schrijft de recepten voor {menu.personen} {menu.personen === 1 ? 'persoon' : 'personen'}.
              Dat duurt ongeveer een halve minuut.
            </p>
          </>
        )}

        {!bezig && menu.draaiboek.length > 0 && (
          <Blok kop="Draaiboek">
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
              {menu.draaiboek.map((r, i) => (
                <li key={i} style={{
                  display: 'grid', gridTemplateColumns: '84px 1fr', gap: 10,
                  fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.4,
                }}>
                  <span style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{r.wanneer}</span>
                  <span>{r.wat}</span>
                </li>
              ))}
            </ul>
          </Blok>
        )}

        {!bezig && !vast && (
          <Blok kop="Pas het menu aan">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (wijziging.trim() && onderweg === null) void vraagAan({ vorig: menu, wijziging: wijziging.trim() })
              }}
              style={{ display: 'flex', gap: 8 }}
            >
              <input
                value={wijziging}
                maxLength={MAX_WENSEN}
                onChange={(e) => setWijziging(e.target.value)}
                aria-label="Wat moet er anders?"
                placeholder="Bijvoorbeeld: er komen ook kinderen"
                autoComplete="off"
                style={{
                  flex: 1, minWidth: 0, border: '1.5px solid var(--c-ink)', borderRadius: 'var(--radius-full)',
                  padding: '10px 14px', fontFamily: 'var(--font-body)', fontSize: 16,
                  background: 'var(--c-cream)', color: 'var(--color-ink)',
                }}
              />
              <Button type="submit" tone="ink" size="sm" disabled={!wijziging.trim() || onderweg !== null}>Pas aan</Button>
            </form>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {BIJSTUREN.map((b) => (
                <Chip key={b} onClick={() => { if (onderweg === null) void vraagAan({ vorig: menu, wijziging: b }) }}>{b}</Chip>
              ))}
            </div>
            {onderweg === 'menu' && <p style={{ ...KLEIN, marginTop: 10 }}>Pinch past het menu aan…</p>}
          </Blok>
        )}

        {vast && !opLijst && (
          <Melding toon="rustig">
            De recepten staan bij je favorieten. De foto's komen er binnen een minuut bij.
          </Melding>
        )}
        {fout && <Melding>{fout}</Melding>}
        {!bezig && <p style={{ ...KLEIN, textAlign: 'center' }}>Gemaakt met Claude</p>}
      </Inhoud>

      {!bezig && (
        <Voet>
          <div style={{
            display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 10,
            fontFamily: 'var(--font-body)', fontSize: 13, color: 'rgba(20,20,20,0.65)',
          }}>
            <span>
              <b style={{ color: 'var(--color-ink)' }}>{producten} producten</b>
              {zoek.size > 0 && `, waarvan ${zoek.size} als zoeklink`}
              {inHuis > 0 && ` · ${inHuis} heb je in huis`}
            </span>
            {kosten !== null && (
              <span style={{ whiteSpace: 'nowrap' }}>
                ca. <b style={{ color: 'var(--color-ink)' }}>{euro(kosten)}</b> · {euro(kosten / menu.personen, true)} p.p.
              </span>
            )}
          </div>
          {opLijst ? (
            <Button onClick={() => navigeer('/boodschappen')} style={{ width: '100%', padding: '17px 24px' }}>
              Naar je lijst
            </Button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Button
                disabled={bewaren || onderweg !== null}
                onClick={() => void bewaar(true)}
                style={{ width: '100%', padding: '17px 24px' }}
              >{bewaren ? 'Even geduld' : 'Zet op mijn lijst'}</Button>
              {!vast && (
                <Button
                  variant="secondary" tone="ink"
                  disabled={bewaren || onderweg !== null}
                  onClick={() => void bewaar(false)}
                  style={{ width: '100%', padding: '13px 24px' }}
                >Bewaar alleen de recepten</Button>
              )}
            </div>
          )}
        </Voet>
      )}
    </Scherm>
  )
}

/** "4 okt 14:05": wanneer je het menu liet maken. */
function datumTekst(iso: string): string {
  return new Date(iso).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

/** "04-10-2026" en "4 oktober": zodat zoeken op een datum op elke schrijfwijze lukt. */
function datumCijfers(iso: string): string {
  const d = new Date(iso)
  return `${d.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })}`
}

const LEAD: CSSProperties = {
  fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.5, margin: 0, color: 'rgba(20,20,20,0.65)',
}
const KLEIN: CSSProperties = {
  fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: 1.45, margin: 0, color: 'rgba(20,20,20,0.65)',
}

function Vraag({ nummer, tekst, bij }: { nummer: number; tekst: string; bij?: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 12,
      fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 800, color: 'var(--color-ink)',
    }}>
      {nummer}. {tekst}
      {bij && <span style={{ fontWeight: 500, fontSize: 12, color: 'rgba(20,20,20,0.6)' }}>{bij}</span>}
    </div>
  )
}

function Melding({ children, toon = 'fout' }: { children: ReactNode; toon?: 'fout' | 'rustig' }) {
  return (
    <p role={toon === 'fout' ? 'alert' : undefined} style={{
      fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.45, margin: 0, padding: '10px 12px',
      borderRadius: 12, color: 'var(--color-ink)',
      background: toon === 'fout' ? 'var(--c-red-100)' : 'var(--c-paper)',
      border: toon === 'fout' ? 'none' : '1.5px dashed rgba(20,20,20,0.35)',
    }}>{children}</p>
  )
}

function Blok({ kop, children }: { kop: string; children: ReactNode }) {
  return (
    <section style={{ background: 'var(--c-paper)', borderRadius: 16, padding: 14 }}>
      <h2 style={{
        fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 15, margin: '0 0 10px',
        textTransform: 'uppercase', color: 'var(--color-ink)',
      }}>{kop}</h2>
      {children}
    </section>
  )
}

/** "1,6 kg", "4 el", "3": de hoeveelheid zoals je hem op een recept leest. */
function hoeveelheid(ing: Ingredient): string {
  if (!ing.hoeveelheid) return ''
  const getal = Number(ing.hoeveelheid.replace(',', '.'))
  if (!Number.isFinite(getal)) return [ing.hoeveelheid, ing.eenheid].filter(Boolean).join(' ')
  const nl = (x: number) => String(Math.round(x * 10) / 10).replace('.', ',')
  if (ing.eenheid === 'g' && getal >= 1000) return `${nl(getal / 1000)} kg`
  if (ing.eenheid === 'ml' && getal >= 1000) return `${nl(getal / 1000)} l`
  return [nl(getal), ing.eenheid].filter(Boolean).join(' ')
}

const KAART_KNOP: CSSProperties = {
  border: '1.5px solid var(--c-ink)', background: 'transparent', borderRadius: 'var(--radius-full)',
  fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700, padding: '8px 14px',
  color: 'var(--color-ink)', cursor: 'pointer',
}

function GerechtKaart({ gerecht, personen, open, bezig, bevat, zoek, receptId, onOpen, onAnder, onRecept }: {
  gerecht: MenuGerecht
  personen: number
  open: boolean
  /** Er is een ander voorstel of een aanpassing onderweg. */
  bezig: boolean
  /** Ingrediënten met een van jouw allergenen, zonder vervanger. */
  bevat: { naam: string; allergenen: string[] }[]
  /** Ingrediëntnamen die als zoeklink gaan. */
  zoek: Set<string>
  /** Gevuld zodra het menu is opgeslagen: dan opent de kaart het echte recept. */
  receptId?: string
  onOpen: () => void
  onAnder?: () => void
  onRecept: (id: string) => void
}) {
  const meta = [
    gerecht.bereidingstijd_minuten ? `${gerecht.bereidingstijd_minuten} min` : null,
    `${gerecht.ingredienten.length} ingrediënten`,
    gerecht.vooraf ? `vooraf: ${gerecht.vooraf}` : null,
  ].filter(Boolean).join(' · ')
  const allergenen = [...new Set(bevat.flatMap((b) => b.allergenen))]

  return (
    <article aria-busy={bezig} style={{
      background: 'var(--c-paper)', borderRadius: 16, overflow: 'hidden', flex: 'none',
      opacity: bezig ? 0.45 : 1, transition: 'opacity var(--motion-base) var(--ease)',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr', gap: 12, padding: 12 }}>
        <div aria-hidden style={{
          width: 56, height: 56, borderRadius: 12, background: 'var(--c-orange)', color: 'var(--c-paper)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><Icon name="utensils" size={24} /></div>
        <div style={{ minWidth: 0 }}>
          <Label kleur="var(--c-red)">{gerecht.rol}</Label>
          <h3 style={{
            fontFamily: 'var(--font-body)', fontSize: 16, fontWeight: 700, lineHeight: 1.25,
            margin: '3px 0 4px', color: 'var(--color-ink)',
          }}>{gerecht.titel}</h3>
          <div style={KLEIN}>{meta}</div>
        </div>
      </div>

      {allergenen.length > 0 && (
        <div style={{
          margin: '0 12px 10px', padding: '8px 10px', borderRadius: 8, background: 'var(--c-red-100)',
          fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: 1.4,
        }}>
          <b>Bevat {opsomming(allergenen.map(allergeenNaam))}</b> ({bevat.map((b) => b.naam).join(', ')}).
          {onAnder && ' Laat dit gerecht vervangen.'}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '0 12px 12px' }}>
        <button onClick={onOpen} aria-expanded={open} style={KAART_KNOP}>
          {open ? 'Verberg recept' : 'Bekijk recept'}
        </button>
        {onAnder && (
          <button onClick={onAnder} style={{ ...KAART_KNOP, borderColor: 'rgba(20,20,20,0.25)' }}>
            {allergenen.length > 0 ? 'Vervang dit gerecht' : 'Ander voorstel'}
          </button>
        )}
        {receptId && (
          <button onClick={() => onRecept(receptId)} style={{ ...KAART_KNOP, borderColor: 'rgba(20,20,20,0.25)' }}>
            Open recept
          </button>
        )}
      </div>

      {open && (
        <div style={{
          borderTop: '1px solid rgba(20,20,20,0.1)', padding: '12px 14px 14px',
          fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.45, color: 'var(--color-ink)',
        }}>
          <Label kleur="rgba(20,20,20,0.6)">Ingrediënten voor {personen}</Label>
          <ul style={{ listStyle: 'none', padding: 0, margin: '6px 0 14px', display: 'grid', gap: 3 }}>
            {gerecht.ingredienten.map((ing, i) => (
              <li key={i} style={{ display: 'grid', gridTemplateColumns: '72px 1fr', gap: 8 }}>
                <span style={{ color: 'rgba(20,20,20,0.6)', fontVariantNumeric: 'tabular-nums' }}>{hoeveelheid(ing)}</span>
                <span>
                  {ing.naam}
                  {zoek.has(ing.naam) && (
                    <span style={{ color: 'var(--c-orange)', fontSize: 12, fontWeight: 700 }}> · zoeklink</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <Label kleur="rgba(20,20,20,0.6)">Bereiding</Label>
          <ol style={{ margin: '6px 0 0', paddingLeft: 20, display: 'grid', gap: 6 }}>
            {gerecht.bereiding_nl.map((stap, i) => <li key={i}>{stap}</li>)}
          </ol>
        </div>
      )}
    </article>
  )
}

/** De plek van het gerecht dat nog onderweg is. */
function Skelet() {
  const balk = (breedte: string, hoogte: number): CSSProperties => ({
    width: breedte, height: hoogte, borderRadius: 8, background: 'rgba(20,20,20,0.08)',
  })
  return (
    <div aria-hidden className="samenstellen-skelet" style={{
      background: 'var(--c-paper)', borderRadius: 16, padding: 12, flex: 'none',
      display: 'grid', gridTemplateColumns: '56px 1fr', gap: 12,
    }}>
      <style>{`
        @keyframes samenstellen-puls { 50% { opacity: 0.45 } }
        .samenstellen-skelet { animation: samenstellen-puls 1.2s ease-in-out infinite }
        @media (prefers-reduced-motion: reduce) { .samenstellen-skelet { animation: none } }
      `}</style>
      <div style={balk('56px', 56)} />
      <div style={{ display: 'grid', gap: 8, alignContent: 'start' }}>
        <div style={balk('40%', 10)} />
        <div style={balk('85%', 14)} />
        <div style={balk('60%', 10)} />
      </div>
    </div>
  )
}
