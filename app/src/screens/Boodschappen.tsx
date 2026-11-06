import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Checkbox, Icon } from '../ds'
import { Inhoud, Kop, Label, OnderBalk, Scherm, Titel, Voet } from '../components/Layout'
import { Fout, Grens, Leeg } from '../components/Staten'
import { Dialoog } from '../components/Dialoog'
import { volgendeWeek } from '../lib/week'
import { useActieveWeek, useBoodschapMuteren, useBoodschappen, useDezeWeek, useJumboMapping, useVoorkeuren } from '../lib/queries'
import { useBestellingen, useBestellingVastleggen, useBoodschappenGedaan, useJumboPrijzen, useJumboVerpakkingen, useVoorraad } from '../lib/queries2'
import { BEZORGING_MANDJE, MAALTIJDBOX, bespaardMet, euro, mandjeKosten, totaalBespaard } from '../lib/besparing'
import type { Bestelling, BoodschapItem } from '../lib/database.types'
import { DROGE_KRUIDEN_KEY, isBijzonderKruid, isDroogKruid } from '../lib/kruiden'
import { inVoorraad } from '../lib/voorraad'
import { alternatieven, bewaarGoedkoperKeuzes, goedkoperOpties, leesGoedkoperKeuzes, metGoedkoperKeuze } from '../lib/goedkoper'
import { bewaarVegaKeuzes, leesVegaKeuzes, metVegaKeuze, vegaOpties, type VegaKeuze } from '../lib/vega'
import { openBijWinkel } from '../lib/ah'
import { tokoProduct } from '../lib/toko'
import { productvoorkeur, useWinkel } from '../lib/winkel'
import { groepeerOpSchap, verpakkingenPerRegel, voegSamen, type LijstRegel } from '../lib/lijst'
import { inhoudTekst } from '../lib/eenheden'
import { bonusVoor, bonusVoordeel, totTekst, useBonus } from '../lib/bonus'
import { bezorgdagen, dagLabel, useBezorgkeuze } from '../lib/bezorgdag'
import { t } from '../lib/taal'
import { BonusBron } from '../components/Bonus'
import {
  bewaarAllergieKeuzes, leesAllergieKeuzes, metAllergieKeuze, opsomming, treffers,
  useAllergeenRegels, useAllergieen, vervangerVoor, type AllergieKeuze,
} from '../lib/allergenen'

/** De keuzelijst onder een regel: vega of vlees, vervanger of origineel. */
/** De keuzelijst in de regel zelf, achter de hoeveelheid. */
const keuzeInRegel: React.CSSProperties = {
  display: 'inline-block', verticalAlign: 'baseline', maxWidth: '100%',
  fontFamily: 'var(--font-body)', fontSize: 16, fontWeight: 700,
  color: 'var(--c-green)', background: 'var(--c-paper)',
  border: '1.5px solid rgba(43,20,32,0.14)', borderRadius: 10, padding: '3px 8px',
}

const keuzeStijl: React.CSSProperties = {
  display: 'block', marginTop: 6, marginLeft: 36, maxWidth: 'calc(100% - 36px)',
  fontFamily: 'var(--font-body)', fontSize: 16, fontWeight: 700,
  color: 'var(--c-green)', background: 'var(--c-paper)',
  border: '1.5px solid rgba(43,20,32,0.14)', borderRadius: 10, padding: '6px 10px',
}

const SUGGESTIES = ['Koffie', 'Brood', 'Melk', 'Bananen', 'Wc-papier']

/** Wat er naar de winkel ging, zodat we na terugkomst kunnen vragen of het aankwam. */
interface Doorgestuurd {
  /** Rijen die van de lijst mogen als het mandje klopt: doorgestuurd + al afgevinkt. */
  ids: string[]
  gemapt: number
  ongemapt: number
  /** Wat niet mee kon naar de winkel: dat blijft op de lijst, en dat melden we. */
  nietMee: string[]
  /** Voor "Bespaard!": vastgelegd zodra je bevestigt dat het mandje aankwam. */
  recepten: Record<string, number>
  kosten: number
  /** Wat de bonus scheelde op producten die zelf in de actie zaten. */
  bonusVoordeel: number
}

export function Boodschappen() {
  const week = useActieveWeek()
  const navigeer = useNavigate()

  const boodschappen = useBoodschappen(week)
  // De lijst loopt over deze en komende week; de recepten dus ook.
  const dezeWeekQuery = useDezeWeek(week)
  const komendeWeekQuery = useDezeWeek(volgendeWeek(week))
  const weekRecepten = useMemo(
    () => [...(dezeWeekQuery.data ?? []), ...(komendeWeekQuery.data ?? [])],
    [dezeWeekQuery.data, komendeWeekQuery.data],
  )
  const winkel = useWinkel()
  const voorraad = useVoorraad()
  const voorkeuren = useVoorkeuren()
  // Voor de besparingsteller altijd in Jumbo-prijzen, ook als je bij AH bestelt.
  const jumboMapping = useJumboMapping(true)
  const jumboPrijzen = useJumboPrijzen()
  const jumboVerpakkingen = useJumboVerpakkingen()
  const bonus = useBonus()
  const kiesBezorgdag = useBezorgkeuze((s) => s.kies)
  const [bezorgVraag, setBezorgVraag] = useState(false)
  const bestellingen = useBestellingen()
  const vastleggen = useBestellingVastleggen(week)
  const gedaan = useBoodschappenGedaan(week)
  const { afvinken, toevoegen, verwijderen, opruimen, allesWissen } = useBoodschapMuteren(week)

  /**
   * De boodschappen zijn in huis, zonder bestelling (zelf gehaald, of alles
   * afgevinkt): de recepten op je lijst gaan naar Te koken, de lijst wordt
   * leeg. Eerst markeren: na het opruimen weet de lijst niet meer welke
   * recepten erop stonden.
   */
  function boodschappenGedaan() {
    const ids = [...new Set(items.flatMap((i) => (i.bron_recept_id ? [i.bron_recept_id] : [])))]
    gedaan.mutate(ids, { onSettled: () => opruimen.mutate(regels.flatMap((r) => r.ids)) })
  }

  const [nieuw, setNieuw] = useState('')
  const [mandjeFout, setMandjeFout] = useState<string | null>(null)
  const [melding, setMelding] = useState<string | null>(null)
  const [doorgestuurd, setDoorgestuurd] = useState<Doorgestuurd | null>(null)
  const [wisVraag, setWisVraag] = useState(false)
  const [nietMee, setNietMee] = useState<string[] | null>(null)
  const [bespaard, setBespaard] = useState<Bestelling | null>(null)
  const [kruidVraag, setKruidVraag] = useState<LijstRegel[] | null>(null)

  const receptenOpLijst = weekRecepten.filter((r) => r.opLijst).length
  const items = useMemo(() => boodschappen.data ?? [], [boodschappen.data])
  const regels = useMemo(() => voegSamen(items), [items])
  const open = regels.filter((r) => !r.afgevinkt)
  // Staan droge kruiden in je voorraadkast, dan blijven kruiden op de lijst
  // maar gaan ze niet mee naar het mandje.
  const kruidenThuis = (voorraad.data ?? []).some((v) => v.ingredient_key === DROGE_KRUIDEN_KEY && v.in_huis)
  // Wat je ná het op de lijst zetten op "in huis" zette, staat er nog wel,
  // maar hoort niet in het mandje.
  const inHuis = useMemo(() => new Set((voorraad.data ?? [])
    .filter((v) => v.in_huis && v.ingredient_key !== DROGE_KRUIDEN_KEY)
    .map((v) => v.ingredient_key)), [voorraad.data])
  const blijftThuis = (key: string) => (kruidenThuis && isDroogKruid(key)) || inVoorraad(key, inHuis)
  // Wat je via de "Op"-knop in de voorraadkast op de lijst zette, is juist op: dat gaat altijd mee.
  const naarWinkel = open.filter((r) => r.items.some((i) => i.voorraad_aanvulling) || !blijftThuis(r.key))
  const thuisOpen = open.length - naarWinkel.length
  const groepen = useMemo(() => groepeerOpSchap(regels), [regels])
  // Bonus op wat je nog moet halen, en wat er afloopt vóór je bezorgdag.
  const metBonus = naarWinkel.filter((r) => bonusVoor(r.naam, bonus.data, r.key)?.length)
  const verloopt = bonus.peildatum.gekozen
    ? naarWinkel.flatMap((r) => {
      if (bonusVoor(r.naam, bonus.data, r.key)?.length) return []
      const vroeg = bonusVoor(r.naam, bonus.vroegst, r.key)
      return vroeg?.length ? [{ naam: r.naam, tot: vroeg[0].geldig_tot }] : []
    })
    : []

  const [vegaKeuzes, setVegaKeuzes] = useState(leesVegaKeuzes)
  const vegaKeuze = (key: string): VegaKeuze => vegaKeuzes[key] ?? 'vega'
  const kiesVega = (key: string, keuze: VegaKeuze) => {
    const nieuw = { ...vegaKeuzes, [key]: keuze }
    setVegaKeuzes(nieuw)
    bewaarVegaKeuzes(nieuw)
  }
  // Goedkoper alternatief (parmezaan → Grana Padano): de keuze per ingrediënt op dit toestel.
  const [goedkoperKeuzes, setGoedkoperKeuzes] = useState(leesGoedkoperKeuzes)
  const kiesGoedkoper = (key: string, keuze: string) => {
    const nieuw = { ...goedkoperKeuzes, [key]: keuze }
    setGoedkoperKeuzes(nieuw)
    bewaarGoedkoperKeuzes(nieuw)
  }
  // Allergieën: de glutenvrije of plantaardige versie gaat standaard mee,
  // net als vega. Per regel terug te zetten; dat onthouden we op dit toestel.
  const allergieen = useAllergieen()
  const opgehaaldeRegels = useAllergeenRegels(allergieen.length > 0).data
  const allergieRegels = allergieen.length > 0 ? opgehaaldeRegels ?? [] : []
  const [allergieKeuzes, setAllergieKeuzes] = useState(leesAllergieKeuzes)
  const allergieKeuze = (key: string): AllergieKeuze => allergieKeuzes[key] ?? 'vervanger'
  const kiesAllergie = (key: string, keuze: AllergieKeuze) => {
    const nieuw = { ...allergieKeuzes, [key]: keuze }
    setAllergieKeuzes(nieuw)
    bewaarAllergieKeuzes(nieuw)
  }
  const allergieVervanger = (regel: LijstRegel) => vervangerVoor(regel.naam, allergieRegels, allergieen)

  /** De rij zoals hij naar de winkel gaat — met de vega-versie en de allergievervanger waar je die koos. */
  const voorWinkel = (regel: LijstRegel) => metAllergieKeuze(
    metVegaKeuze(metGoedkoperKeuze(regel.voorbeeld, goedkoperKeuzes[regel.key]), vegaKeuze(regel.key)),
    allergieKeuze(regel.key), allergieRegels, allergieen,
  )

  // Wat wel naar de winkel moet maar geen productnummer heeft, komt niet in
  // het mandje. Dat moet je vóór en na het doorsturen in één oogopslag zien.
  /** Verpakkingen geteld per product: twee regels uit dezelfde pot vragen samen één pot. */
  const tel = (lijst: LijstRegel[]) => verpakkingenPerRegel(
    lijst, (r) => winkel.productVoor(voorWinkel(r)), (r) => winkel.verpakkingVoor(voorWinkel(r)),
  )
  const aantallen = tel(naarWinkel)

  const nietGevonden = naarWinkel.filter((r) => !winkel.heeftProduct(voorWinkel(r)))

  /**
   * `zonder`: bijzondere kruiden die je volgens de vraag hieronder al in huis
   * hebt. `gevraagd`: die vraag is al gesteld.
   */
  async function naarMandje(zonder: ReadonlySet<string> = new Set(), gevraagd = false) {
    setMandjeFout(null)
    setMelding(null)
    // Heb je "Droge kruiden" in huis, dan gaan sumak en za'atar toch mee: die
    // heeft niet iedereen staan. Maar we vragen het eerst.
    const bijzonder = kruidenThuis ? naarWinkel.filter((r) => isBijzonderKruid(r.key)) : []
    if (!gevraagd && bijzonder.length > 0) {
      setKruidVraag(bijzonder)
      return
    }
    const mee = naarWinkel.filter((r) => !zonder.has(r.key))
    // Zoveel verpakkingen als het recept vraagt: drie pakken gehakt, vier paprika's.
    const meeAantallen = tel(mee)
    const { url, gemapt, ongemapt } = winkel.mandjeLink(mee.map((r) => ({
      ...voorWinkel(r), aantal: meeAantallen.get(r.key)?.aantal ?? 1,
    })))
    if (gemapt.length === 0) {
      setMelding(
        t('Geen van deze producten heeft nog een {winkel}-productnummer.', { winkel: winkel.kort }) + ' ' +
        t('Gebruik de zoeklinks bij de producten.'),
      )
      return
    }
    try {
      await openBijWinkel(url)
      const gemapteIds = new Set(gemapt.map((i) => i.id))
      const weg = regels
        .filter((r) => r.afgevinkt || gemapteIds.has(r.voorbeeld.id))
        .flatMap((r) => r.ids)
      // Bewust eerst vragen: we kunnen niet controleren of het aankwam. AH
      // voegt niets toe als je daar niet ingelogd bent, zonder foutmelding, en
      // bij Jumbo kan het in een ander mandje landen dan dat in je Jumbo-app.
      // Alles wat naar de winkel gaat telt mee, ook wat je los koopt: een
      // maaltijdbox levert ook het hele recept.
      const aantalPerRecept = new Map(weekRecepten.map((r) => [r.id, r.aantal]))
      // Een zelf samengesteld menu (tien gasten) is geen maaltijd uit een box
      // voor je huishouden: het telt niet mee voor Bespaard!, niet als maaltijd
      // en niet in de kosten van het mandje.
      const menuRecepten = new Set(weekRecepten.filter((r) => r.bron_type === 'samengesteld').map((r) => r.id))
      const uitMenu = (i: BoodschapItem) => Boolean(i.bron_recept_id && menuRecepten.has(i.bron_recept_id))
      const meeZonderMenu = mee
        .map((r) => ({ ...r, items: r.items.filter((i) => !uitMenu(i)) }))
        .filter((r) => r.items.length > 0)
      const recepten: Record<string, number> = {}
      for (const r of meeZonderMenu) {
        for (const i of r.items) {
          if (i.bron_recept_id) recepten[i.bron_recept_id] = aantalPerRecept.get(i.bron_recept_id) ?? 1
        }
      }
      // Bonus telt alleen als het product in je mandje zelf in de actie zit,
      // en je genoeg stuks koopt (1 + 1 gratis: twee).
      let voordeel = 0
      for (const r of mee) {
        if (!gemapteIds.has(r.voorbeeld.id)) continue
        const item = voorWinkel(r)
        const product = winkel.productVoor(item)
        const aantal = meeAantallen.get(r.key)?.aantal ?? 1
        const acties = (bonusVoor(r.naam, bonus.data, r.key) ?? []).filter((a) => a.extern_id === product)
        voordeel += Math.max(0, ...acties.map((a) => bonusVoordeel(a, aantal)))
      }
      setDoorgestuurd({
        ids: weg, gemapt: gemapt.length, ongemapt: ongemapt.length,
        bonusVoordeel: Math.round(voordeel * 100) / 100,
        nietMee: mee.filter((r) => !gemapteIds.has(r.voorbeeld.id)).map((r) => r.label),
        recepten,
        kosten: mandjeKosten(
          meeZonderMenu, jumboMapping.data ?? {}, jumboPrijzen.data ?? {},
          productvoorkeur(voorkeuren.data), jumboVerpakkingen.data ?? {},
        ).totaal,
      })
    } catch {
      setMandjeFout(t('Het mandje is niet aangekomen. Je lijst is bewaard — er is niets kwijt.'))
    }
  }

  if (mandjeFout && open.length > 0) {
    return (
      <Fout
        kop={t('Je mandje is niet aangekomen')}
        tekst={mandjeFout}
        stappen={[
          t('Log eerst in bij {winkel} — uitgelogd kan je mandje leeg blijven, zonder melding.', { winkel: winkel.naam }),
          t('Probeer het daarna opnieuw.'),
          t('Lukt het niet? Vink de lijst zelf af in de winkel.'),
        ]}
        onOpnieuw={() => { void naarMandje() }}
        onTerug={() => setMandjeFout(null)}
      />
    )
  }

  return (
    <Scherm>
      <Grens query={boodschappen} ladenTekst={t('Boodschappenlijst ophalen')}>
        <Kop kleur="var(--c-green)">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <Label>{receptenOpLijst === 1 ? t('{n} recept', { n: receptenOpLijst }) : t('{n} recepten', { n: receptenOpLijst })}</Label>
            {items.length > 0 && (
              <button
                onClick={() => setWisVraag(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, border: '1.5px solid rgba(248,241,236,0.5)',
                  background: 'transparent', color: 'var(--c-cream)', borderRadius: 'var(--radius-full)',
                  padding: '6px 12px', cursor: 'pointer',
                  fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700,
                }}
              ><Icon name="trash" size={13} />{t('Alles wissen')}</button>
            )}
          </div>
          <div style={{ marginTop: 14 }}><Titel>{t('Boodschappen')}</Titel></div>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.5, margin: '10px 0 0' }}>
            {regels.length === 0
              ? t('Nog niets op je lijst.')
              : t('{n} van de {totaal} producten nog nodig · op volgorde van de winkel', { n: naarWinkel.length, totaal: regels.length })}
          </p>
        </Kop>

        {regels.length === 0 ? (
          <Leeg
            icoon="cart"
            kop={t('Je lijst is leeg')}
            tekst={t('Zet een recept op je lijst, dan komen de ingrediënten hier vanzelf te staan.')}
            knop={t('Naar Mijn recepten')}
            onKnop={() => navigeer('/mijn-recepten', { state: { tab: 'bestellen' } })}
          />
        ) : (
          <Inhoud style={{ gap: 18 }}>
            {melding && (
              <div style={{
                background: 'var(--c-warm-300)', borderRadius: 'var(--radius-sm)', padding: '12px 14px',
                fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.4,
              }}>{melding}</div>
            )}

            {groepen.map((groep) => (
              <div key={groep.schap} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', paddingBottom: 6 }}>
                  <span style={{
                    fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, letterSpacing: '.1em',
                    textTransform: 'uppercase', color: 'var(--c-green)',
                  }}>{t(groep.schap)}</span>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, color: 'rgba(43,20,32,0.6)' }}>
                    {t('{n} van {totaal}', { n: groep.regels.filter((r) => !r.afgevinkt).length, totaal: groep.regels.length })}
                  </span>
                </div>

                {groep.regels.map((regel) => (
                  <div key={regel.key} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 2px',
                    borderBottom: '1.5px solid rgba(43,20,32,0.12)',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Checkbox
                        checked={regel.afgevinkt}
                        onChange={() => afvinken.mutate({ itemIds: regel.ids, afgevinkt: !regel.afgevinkt })}
                      >
                        {(() => {
                          // Vlees of vega: de keuze staat op de plek van de naam ("800 g [Rundergehakt ▾]"),
                          // anders staat er boven rundergehakt en kies je eronder vegagehakt, en klopt het niet meer.
                          const opties = regel.afgevinkt ? [] : vegaOpties(regel.key)
                          if (opties.length === 0) return regel.label
                          const kleineNaam = regel.naam.toLowerCase()
                          const hoeveelheid = regel.label.endsWith(kleineNaam)
                            ? regel.label.slice(0, regel.label.length - kleineNaam.length).trim() : ''
                          // "vegagehakt (of gehakt)" heet in de lijst gewoon Vegagehakt.
                          const kaal = regel.naam.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim()
                          const receptNaam = kaal.charAt(0).toUpperCase() + kaal.slice(1)
                          return (
                            <>
                              {hoeveelheid && `${hoeveelheid} `}
                              {/* De tik op de keuzelijst mag het vinkje niet omzetten. */}
                              <select
                                value={vegaKeuze(regel.key)}
                                onChange={(e) => kiesVega(regel.key, e.target.value as VegaKeuze)}
                                onClick={(e) => e.stopPropagation()}
                                aria-label={t('Vega of vlees voor {naam}', { naam: regel.naam })}
                                style={keuzeInRegel}
                              >
                                {opties.map((o) => <option key={o.keuze} value={o.keuze}>{o.label ?? receptNaam}</option>)}
                              </select>
                            </>
                          )
                        })()}
                      </Checkbox>
                      {nietGevonden.includes(regel) && (
                        <span style={{
                          display: 'block', marginLeft: 36, marginTop: 3,
                          fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, color: 'var(--c-red)',
                        }}>{t('Komt niet in je mandje · koop zelf')}</span>
                      )}
                      {!regel.afgevinkt && !blijftThuis(regel.key) && (() => {
                        // "Bonus: 3 voor 4.99 t/m zondag": alleen als tip, het mandje verandert niet.
                        const acties = bonusVoor(regel.naam, bonus.data, regel.key)
                        if (!acties?.length) return null
                        const a = acties[0]
                        return (
                          <span style={{
                            display: 'block', marginLeft: 36, marginTop: 3,
                            fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, color: 'var(--c-red)',
                          }}>
                            {t('Bonus:')} {a.mechanisme ?? t('in de aanbieding')} {totTekst(a.geldig_tot)}
                            <span style={{ fontWeight: 400 }}> · <BonusBron klein /></span>
                          </span>
                        )
                      })()}
                      {!regel.afgevinkt && (() => {
                        // "2× 500 g": dan zie je waarom er twee in je mandje gaan.
                        const verpakking = winkel.verpakkingVoor(voorWinkel(regel))
                        const aantal = aantallen.get(regel.key)
                        if (!verpakking || !aantal) return null
                        return (
                          <span style={{
                            display: 'block', marginLeft: 36, marginTop: 2,
                            fontFamily: 'var(--font-body)', fontSize: 12, color: 'rgba(43,20,32,0.55)',
                          }}>
                            {aantal.totaal}× {inhoudTekst(verpakking)}
                            {aantal.samenMet.length > 0 && t(' · samen met {namen}', { namen: aantal.samenMet.join(` ${t('en')} `) })}
                          </span>
                        )
                      })()}
                      {!regel.afgevinkt && (() => {
                        // Een goedkoper product dat hetzelfde doet: kies het in de lijst, dan zie je wat het scheelt.
                        const gekozen = goedkoperKeuzes[regel.key]
                        const opties = goedkoperOpties(regel, winkel)
                        const lijst = gekozen && !opties.some((o) => o.key === gekozen)
                          ? [...opties, ...alternatieven(regel.voorbeeld.ingredient_key).filter((a) => a.key === gekozen).map((a) => ({ ...a, scheelt: 0 }))]
                          : opties
                        if (lijst.length === 0) return null
                        const huidig = lijst.find((o) => o.key === gekozen)
                        const naam = regel.voorbeeld.naam
                        return (
                          <>
                            <select
                              value={gekozen ?? 'recept'}
                              onChange={(e) => kiesGoedkoper(regel.key, e.target.value)}
                              aria-label={t('Goedkoper alternatief voor {naam}', { naam: regel.naam })}
                              style={keuzeStijl}
                            >
                              <option value="recept">{naam.charAt(0).toUpperCase() + naam.slice(1)}</option>
                              {lijst.map((o) => (
                                <option key={o.key} value={o.key}>
                                  {o.label}{o.scheelt > 0 ? t(' · scheelt {bedrag}', { bedrag: euro(o.scheelt, true) }) : ''}
                                </option>
                              ))}
                            </select>
                            <span style={{
                              display: 'block', marginLeft: 36, marginTop: 3,
                              fontFamily: 'var(--font-body)', fontSize: 12, color: 'rgba(43,20,32,0.55)',
                            }}>
                              {huidig
                                ? `${huidig.uitleg} ${t('Je koos het goedkopere product.')}`
                                : `${t('Duur product: kies een alternatief dat bij {winkel} minder kost.', { winkel: winkel.naam })} ${lijst[0].uitleg}`}
                            </span>
                          </>
                        )
                      })()}
                      {!regel.afgevinkt && allergieen.length > 0 && (() => {
                        const vervanger = allergieVervanger(regel)
                        if (vervanger) {
                          return (
                            <select
                              value={allergieKeuze(regel.key)}
                              onChange={(e) => kiesAllergie(regel.key, e.target.value as AllergieKeuze)}
                              aria-label={t('Vervanger of origineel voor {naam}', { naam: regel.naam })}
                              style={keuzeStijl}
                            >
                              <option value="vervanger">{vervanger.charAt(0).toUpperCase() + vervanger.slice(1)}</option>
                              <option value="recept">{regel.naam.charAt(0).toUpperCase() + regel.naam.slice(1)}</option>
                            </select>
                          )
                        }
                        // Geen vervanger: zeggen wat erin zit, of dat het etiket beslist.
                        const mijn = treffers(regel.naam, allergieRegels).filter((tr) => allergieen.includes(tr.allergeen))
                        if (mijn.length === 0) return null
                        const zeker = mijn.filter((tr) => tr.zeker).map((tr) => tr.allergeen)
                        return (
                          <span style={{
                            display: 'block', marginLeft: 36, marginTop: 3,
                            fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700,
                            color: zeker.length > 0 ? 'var(--c-red)' : 'rgba(43,20,32,0.6)',
                          }}>
                            {zeker.length > 0
                              ? t('Bevat {x}', { x: opsomming(zeker) })
                              : t('Check het etiket op {x}', { x: opsomming(mijn.map((tr) => tr.allergeen)) })}
                          </span>
                        )
                      })()}
                    </div>
                    {blijftThuis(regel.key) ? (
                      <span style={{
                        fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, color: 'rgba(43,20,32,0.5)',
                      }}>{t('thuis')}</span>
                    ) : !winkel.heeftProduct(voorWinkel(regel)) && (() => {
                      // Niet bij de winkel, wel bij de toko? Dan daarheen in plaats van zoeken.
                      const toko = tokoProduct(regel.voorbeeld)
                      const url = toko?.url ?? winkel.zoekLink(voorWinkel(regel).naam)
                      return (
                        <a
                          href={url}
                          onClick={(e) => { e.preventDefault(); void openBijWinkel(url) }}
                          aria-label={toko ? t("{naam} bij Tjin's Toko", { naam: toko.naam }) : undefined}
                          style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}
                        >{toko ? t('toko') : t('zoek')}</a>
                      )
                    })()}
                    <button
                      onClick={() => verwijderen.mutate(regel.ids)}
                      aria-label={t('{naam} verwijderen', { naam: regel.naam })}
                      style={{
                        flex: 'none', width: 28, height: 28, borderRadius: 'var(--radius-full)',
                        border: 'none', background: 'transparent', color: 'rgba(43,20,32,0.45)',
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
              }}>{t('Zelf toevoegen')}</span>

              <form
                onSubmit={(e) => { e.preventDefault(); toevoegen.mutate(nieuw); setNieuw('') }}
                style={{ display: 'flex', gap: 8 }}
              >
                <input
                  value={nieuw}
                  onChange={(e) => setNieuw(e.target.value)}
                  placeholder={t('Bijv. koffiebonen')}
                  style={{
                    flex: 1, minWidth: 0, background: 'var(--c-paper)',
                    border: '1.5px solid rgba(43,20,32,0.14)', borderRadius: 14,
                    padding: '13px 15px', fontFamily: 'var(--font-body)', fontSize: 16,
                  }}
                />
                <button type="submit" style={{
                  flex: 'none', border: 'none', borderRadius: 14, padding: '0 18px',
                  background: 'var(--c-red)', color: 'var(--c-cream)',
                  fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                }}>{t('Toevoegen')}</button>
              </form>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {SUGGESTIES
                  .filter((s) => !regels.some((r) => r.naam.toLowerCase() === s.toLowerCase()))
                  .slice(0, 4)
                  .map((s) => (
                    <button key={s} onClick={() => toevoegen.mutate(s)} style={{
                      border: '1.5px solid rgba(43,20,32,0.14)', background: 'transparent',
                      borderRadius: 'var(--radius-full)', padding: '8px 14px',
                      fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    }}>+ {t(s)}</button>
                  ))}
              </div>
            </div>
          </Inhoud>
        )}

        {regels.length > 0 && (
          <Voet meeschuiven>
            {naarWinkel.length === 0 ? (
              // Alles afgevinkt (of alleen kruiden over): je bent klaar. Dan mag de lijst leeg.
              <Button
                tone="green"
                onClick={boodschappenGedaan}
                style={{ width: '100%', padding: '17px 24px', fontSize: 16 }}
              >{t('Boodschappen gedaan')}</Button>
            ) : (
              <>
              {!bonus.peildatum.zelfHalen && (metBonus.length > 0 || verloopt.length > 0) && (
                <div style={{
                  fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: 1.4, margin: '0 0 10px',
                  display: 'flex', flexDirection: 'column', gap: 4, textAlign: 'center',
                }}>
                  <span>
                    {t('Bezorging op:')} <strong>{dagLabel(bonus.peildatum.peil)}</strong> ·{' '}
                    <button
                      onClick={() => setBezorgVraag(true)}
                      style={{
                        border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: 'var(--c-red)',
                        fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700, textDecoration: 'underline',
                      }}
                    >{t('wijzig')}</button>
                  </span>
                  {verloopt.slice(0, 2).map((v) => (
                    <span key={v.naam} style={{ color: 'var(--c-red)', fontWeight: 700 }}>
                      {t('{naam} is nog {tot} in de bonus. Laat je eerder bezorgen?', {
                        naam: v.naam.charAt(0).toUpperCase() + v.naam.slice(1), tot: totTekst(v.tot),
                      })}
                    </span>
                  ))}
                </div>
              )}
              {nietGevonden.length > 0 && (
                <div role="alert" style={{
                  background: 'var(--c-warm-300)', border: '1.5px solid var(--c-red)',
                  borderRadius: 'var(--radius-sm)', padding: '10px 12px', margin: '0 0 10px',
                  fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: 1.4,
                }}>
                  <strong style={{ color: 'var(--c-red)' }}>
                    {nietGevonden.length === 1
                      ? t('1 product komt niet in je mandje:')
                      : t('{n} producten komen niet in je mandje:', { n: nietGevonden.length })}
                  </strong>{' '}
                  {nietGevonden.map((r) => r.naam.toLowerCase()).join(', ')}. {nietGevonden.length === 1 ? t('Koop dit zelf.') : t('Koop deze zelf.')}
                </div>
              )}
              <Button
                onClick={() => { void naarMandje() }}
                style={{ width: '100%', padding: '17px 24px', fontSize: 16 }}
              >{t('Naar {winkel}-mandje ({n})', { winkel: winkel.kort, n: naarWinkel.length - nietGevonden.length })}</Button>
              {/* Wie zelf haalt bestelt niet: dan zeg je hier dat de boodschappen in huis zijn. */}
              {voorkeuren.data?.zelf_halen && (
                <Button
                  variant="secondary" tone="green"
                  onClick={boodschappenGedaan}
                  style={{ width: '100%', padding: '15px 24px', fontSize: 15, marginTop: 8 }}
                >{t('Boodschappen gedaan')}</Button>
              )}
              </>
            )}
            <p style={{
              fontFamily: 'var(--font-body)', fontSize: 12, lineHeight: 1.4, margin: '8px 0 0',
              textAlign: 'center', color: 'rgba(43,20,32,0.6)',
            }}>
              {naarWinkel.length === 0
                ? t('Je lijst wordt leeggemaakt. Je recepten gaan naar Te koken.')
                : thuisOpen > 0
                  ? t('Afgevinkte producten en wat je in huis hebt laten we uit je mandje. Check wel even je kruidenrek.')
                  : t('Afgevinkte producten laten we uit je mandje.')}
            </p>
          </Voet>
        )}
      </Grens>

      <Dialoog
        open={bezorgVraag}
        kop={t('Wanneer laat je bezorgen?')}
        tekst={t('De bonus geldt voor de dag van bezorgen. Kies de dag die je bij je winkel kiest, dan kloppen de bonuslabels.')}
        onSluit={() => setBezorgVraag(false)}
        acties={bezorgdagen().map((dag, i) => ({
          label: dagLabel(dag),
          hoofd: dag === bonus.peildatum.peil,
          onClick: () => { kiesBezorgdag(i === 0 ? null : dag); setBezorgVraag(false) },
        }))}
      />
      <Dialoog
        open={Boolean(kruidVraag)}
        kop={t('Heb je deze kruiden in huis?')}
        tekst={kruidVraag
          ? (kruidVraag.length === 1
            ? t('{namen} heeft niet iedereen staan. Zullen we het in je mandje doen?', { namen: naamLijst(kruidVraag.map((r) => r.naam)) })
            : t('{namen} heeft niet iedereen staan. Zullen we ze in je mandje doen?', { namen: naamLijst(kruidVraag.map((r) => r.naam)) }))
          : undefined}
        onSluit={() => setKruidVraag(null)}
        acties={[
          { label: t('Ja, doe in mijn mandje'), hoofd: true, onClick: () => { setKruidVraag(null); void naarMandje(new Set(), true) } },
          {
            label: t('Nee, heb ik al'),
            onClick: () => {
              const zonder = new Set((kruidVraag ?? []).map((r) => r.key))
              setKruidVraag(null)
              void naarMandje(zonder, true)
            },
          },
        ]}
      />
      <Dialoog
        open={Boolean(doorgestuurd)}
        kop={t('Staat alles in je {winkel}-mandje?', { winkel: winkel.kort })}
        tekst={doorgestuurd
          ? (doorgestuurd.gemapt === 1
              ? t('{n} product doorgestuurd naar {winkel}.', { n: doorgestuurd.gemapt, winkel: winkel.naam })
              : t('{n} producten doorgestuurd naar {winkel}.', { n: doorgestuurd.gemapt, winkel: winkel.naam })) + ' ' +
            t('Zie je ze in je mandje, dan halen we ze van je lijst.') +
            (winkel.id === 'ah' ? ' ' + t('Is je mandje leeg? Log dan één keer in op ah.nl in Safari en probeer het opnieuw.') : '') +
            (doorgestuurd.nietMee.length > 0
              ? ' ' + t('LET OP, níét doorgestuurd: {lijst}. Die blijven op je lijst; koop ze zelf.', { lijst: doorgestuurd.nietMee.join(', ') })
              : '')
          : undefined}
        onSluit={() => setDoorgestuurd(null)}
        acties={[
          {
            label: t('Ja, haal van mijn lijst'),
            hoofd: true,
            onClick: () => {
              if (doorgestuurd) {
                opruimen.mutate(doorgestuurd.ids)
                if (doorgestuurd.nietMee.length > 0) setNietMee(doorgestuurd.nietMee)
                vastleggen.mutate({
                  winkel: winkel.id,
                  personen: voorkeuren.data?.aantal_personen ?? 4,
                  recepten: doorgestuurd.recepten,
                  mandjeKosten: doorgestuurd.kosten,
                  bezorgdatum: bonus.peildatum.peil,
                  bonusVoordeel: doorgestuurd.bonusVoordeel,
                }, {
                  // Alleen vieren als er maaltijden bij kwamen; een tweede ronde
                  // voor een vergeten ui is geen besparing.
                  onSuccess: (b) => { if (b.maaltijden > 0) setBespaard(b) },
                })
              }
              setDoorgestuurd(null)
            },
          },
          {
            label: t('Nee, mijn mandje is leeg'),
            onClick: () => {
              setDoorgestuurd(null)
              setMelding(winkel.id === 'jumbo'
                ? t('Kijk ook in Safari op jumbo.com: staat de Jumbo-app los van Safari, dan kan je mandje daar terechtgekomen zijn. Log in Safari in bij Jumbo en tik opnieuw op Naar Jumbo-mandje. Je lijst is niet veranderd.')
                : t('Dan ben je bij AH waarschijnlijk niet ingelogd — dan voegt AH niets toe, zonder melding. Log daar in en tik opnieuw op Naar AH-mandje. Je lijst is niet veranderd.'),
              )
            },
          },
        ]}
      />

      <Dialoog
        open={Boolean(nietMee)}
        kop={t('Let op: dit moet je zelf nog kopen')}
        tekst={nietMee
          ? t("Deze producten zitten níét in je {winkel}-mandje: {lijst}. Ze blijven op je lijst. Koop ze los — bij {winkel} via 'zoek', of in een andere winkel.", { winkel: winkel.kort, lijst: nietMee.join(', ') })
          : undefined}
        onSluit={() => setNietMee(null)}
        acties={[{ label: t('Oké, ik koop ze zelf'), hoofd: true, onClick: () => setNietMee(null) }]}
      />

      <Dialoog
        open={Boolean(bespaard) && !nietMee}
        kop={bespaard ? t('{bedrag} bespaard!', { bedrag: euro(bespaardMet(bespaard)) }) : ''}
        tekst={bespaard
          ? t("Deze boodschappen kosten zo'n {kosten}, {bezorging} bezorging inbegrepen.", {
              kosten: euro(bespaard.mandje_kosten), bezorging: euro(BEZORGING_MANDJE),
            }) + ' ' +
            (bespaard.maaltijden === 1
              ? t('Dezelfde {n} maaltijd voor {personen} bij {box}: {kosten}.', {
                n: bespaard.maaltijden, personen: bespaard.personen, box: t(MAALTIJDBOX.naam), kosten: euro(bespaard.maaltijdbox_kosten),
              })
              : t('Dezelfde {n} maaltijden voor {personen} bij {box}: {kosten}.', {
                n: bespaard.maaltijden, personen: bespaard.personen, box: t(MAALTIJDBOX.naam), kosten: euro(bespaard.maaltijdbox_kosten),
              })) + ' ' +
            // De lijst kan nog aan het verversen zijn; deze bestelling telt hoe dan ook mee.
            t('Totaal bespaard met de app: {bedrag}.', {
              bedrag: euro(totaalBespaard([
                ...(bestellingen.data ?? []).filter((b) => b.id !== bespaard.id), bespaard,
              ])),
            })
          : undefined}
        onSluit={() => setBespaard(null)}
        acties={[
          { label: t('Top!'), hoofd: true, onClick: () => setBespaard(null) },
          { label: t('Bekijk wat je bespaarde'), onClick: () => { setBespaard(null); navigeer('/bespaard') } },
        ]}
      />

      <Dialoog
        open={wisVraag}
        kop={t('Weet je het zeker?')}
        tekst={t('Alle producten gaan van je lijst. Je recepten blijven in Deze week staan, zonder gele rand.')}
        onSluit={() => setWisVraag(false)}
        acties={[
          { label: t('Ja, alles wissen'), hoofd: true, onClick: () => { allesWissen.mutate(); setWisVraag(false) } },
          { label: t('Annuleer'), onClick: () => setWisVraag(false) },
        ]}
      />

      <OnderBalk />
    </Scherm>
  )
}

/** "sumak, kardemom en za'atar" */
function naamLijst(namen: string[]): string {
  const eerste = namen[0].charAt(0).toUpperCase() + namen[0].slice(1)
  const rest = [eerste, ...namen.slice(1)]
  return rest.length === 1 ? rest[0] : t('{lijst} en {laatste}', { lijst: rest.slice(0, -1).join(', '), laatste: rest[rest.length - 1] })
}
