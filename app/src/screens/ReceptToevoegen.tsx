import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Icon } from '../ds'
import { Inhoud, Kop, Label, Scherm, Titel, Voet } from '../components/Layout'
import { foutTekst } from '../lib/fouten'
import {
  BestaatAl, MAX_SCREENSHOTS, leesFoto, leesLink, leesScreenshots, leesTekst, type Concept, type Uitgelezen,
} from '../lib/extractie'
import { bronTypeVoor, normaliseerUrl, isInstagramUrl, siteNaam } from '../lib/importeren'
import { useReceptOpslaan } from '../lib/queries2'
import { openBijWinkel } from '../lib/ah'
import type { BronType } from '../lib/database.types'

type Stap = 'kiezen' | 'invoer' | 'bezig' | 'concept'

/**
 * Waar het recept vandaan komt bepaalt wat ermee mag.
 *
 *  link           — een website of Instagram-post; altijd privé, met bronvermelding.
 *  screenshots    — een of meer screenshots van een recept; altijd privé.
 *  prive_kookboek — foto van een kookboekpagina, blijft altijd van jou alleen.
 *  eigen          — je eigen bedenksel, mag je aanmelden om te delen.
 */
type Route = 'link' | 'screenshots' | 'prive_kookboek' | 'eigen'

/** De routes zoals ze in de URL staan (?route=…), voor de knop Toevoegen op Ontdekken. */
const ROUTES: Record<string, Route | 'zelf'> = {
  link: 'link', screenshots: 'screenshots', kookboek: 'prive_kookboek', eigen: 'eigen', zelf: 'zelf',
}

const LEEG: Concept = {
  titel: '', personen: 4, tags: [], ingredienten: [], bereiding_nl: [],
}

/**
 * Recept toevoegen (plan §7 en het importplan).
 *
 * Vier routes: een link (website of Instagram), screenshots, een foto van een
 * kookboekpagina, of je eigen recept in vrije tekst. Alles komt uit op
 * hetzelfde conceptscherm waar jij controleert wat eruit kwam — het model
 * doet soms een verkeerde aanname over een hoeveelheid, en een video is niet
 * altijd goed te verstaan.
 *
 * Wat de server ophaalt (pagina, video, foto's) wordt na het uitlezen
 * weggegooid, niet opgeslagen. Van een import blijven alleen het recept, de
 * link en de naam van de maker over; die staan op het receptscherm.
 *
 * Opent ook via /toevoegen?route=link&url=… (straks de deelknop van iOS).
 */
export function ReceptToevoegen() {
  const navigeer = useNavigate()
  const [params] = useSearchParams()
  const opslaan = useReceptOpslaan()

  const gevraagd = ROUTES[params.get('route') ?? '']
  const [stap, setStap] = useState<Stap>(gevraagd ? (gevraagd === 'zelf' ? 'concept' : 'invoer') : 'kiezen')
  const [route, setRoute] = useState<Route>(gevraagd && gevraagd !== 'zelf' ? gevraagd : 'eigen')
  const [tekst, setTekst] = useState('')
  const [link, setLink] = useState(params.get('url') ?? '')
  const [stapTekst, setStapTekst] = useState('')
  const [concept, setConcept] = useState<Concept>(LEEG)
  const [scanId, setScanId] = useState<string | null>(null)
  const [delen, setDelen] = useState(false)
  const [fout, setFout] = useState('')
  const bestandKiezer = useRef<HTMLInputElement>(null)

  const kookboek = route === 'prive_kookboek'
  // Een import is van de maker: nooit in de pool. Een eigen tekst mag je aanmelden.
  const bron: BronType = concept.bron ? bronTypeVoor(concept.bron.soort) : kookboek ? 'kookboek_foto' : 'eigen_input'
  const magDelen = bron === 'eigen_input'

  async function verwerk(actie: (opStap: (t: string) => void) => Promise<Uitgelezen>) {
    setStap('bezig'); setFout(''); setStapTekst('')
    try {
      const { concept, scanId } = await actie(setStapTekst)
      setConcept(concept)
      setScanId(scanId)
      setStap('concept')
    } catch (f) {
      if (f instanceof BestaatAl) {
        navigeer(`/recept/${f.receptId}`, { replace: true, state: { terug: '/ontdekken' } })
        return
      }
      setFout(foutTekst(f))
      setStap('invoer')
    }
  }

  // Gedeeld vanuit een andere app: meteen aan de slag, zonder eerst op een knop te tikken.
  const gestart = useRef(false)
  useEffect(() => {
    const url = params.get('url')
    if (!url || gestart.current) return
    gestart.current = true
    void verwerk((opStap) => leesLink(url, opStap))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function bewaar() {
    opslaan.mutate(
      {
        concept,
        bronType: bron,
        // Kookboek en imports kunnen nooit gedeeld worden (plan §7.3) — hier én in
        // de database afgedwongen met check-constraints.
        deelStatus: magDelen && delen ? 'aangevraagd' : 'prive',
        url: concept.bron?.url ?? null,
        bronMaker: concept.bron?.maker ?? null,
        scanId,
      },
      {
        // Terug vanaf het nieuwe recept gaat naar Ontdekken, niet naar het toevoegscherm (dat is al vervangen).
        onSuccess: (id) => navigeer(`/recept/${id}`, { replace: true, state: { terug: '/ontdekken' } }),
        onError: (f) => setFout(foutTekst(f)),
      },
    )
  }

  const linkGeldig = normaliseerUrl(link) !== null
  const titel = stap === 'kiezen' ? 'Waar komt het vandaan?'
    : stap === 'concept' ? 'Klopt dit?'
    : stap === 'bezig' ? 'Even geduld'
    : route === 'link' ? 'Van een link'
    : route === 'screenshots' ? 'Van screenshots'
    : kookboek ? 'Uit je kookboek' : 'Je eigen recept'

  return (
    <Scherm>
      <Kop kleur="var(--c-purple)" style={{ paddingBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => {
              if (stap !== 'kiezen' && !gevraagd) return setStap('kiezen')
              // Geopend via een link van buiten: dan is er geen vorige pagina.
              if (((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0) navigeer(-1)
              else navigeer('/ontdekken')
            }}
            aria-label="Terug"
            style={{
              border: 'none', background: 'rgba(255,246,232,0.22)', color: 'var(--c-cream)',
              width: 36, height: 36, borderRadius: 'var(--radius-full)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          ><Icon name="chevronLeft" size={18} /></button>
          <Label>Recept toevoegen</Label>
        </div>
        <div style={{ marginTop: 14 }}>
          <Titel grootte={26}>{titel}</Titel>
        </div>
      </Kop>

      {fout && (
        <div style={{
          flex: 'none', margin: '14px 22px 0', background: 'var(--c-warm-300)',
          borderRadius: 'var(--radius-sm)', padding: '12px 14px',
          fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.4,
        }}>{fout}</div>
      )}

      {stap === 'kiezen' && (
        <Inhoud style={{ gap: 12 }}>
          <Keuze
            icoon="share"
            kop="Plak een link"
            tekst="Van Instagram of een receptensite. We halen het recept op en zetten het om naar jouw lijst."
            onClick={() => { setRoute('link'); setStap('invoer') }}
          />
          <Keuze
            icoon="grid"
            kop="Kies screenshots"
            tekst={`Tot ${MAX_SCREENSHOTS} screenshots van één recept, bijvoorbeeld uit een app of een story.`}
            onClick={() => { setRoute('screenshots'); setStap('invoer') }}
          />
          <Keuze
            icoon="chefHat"
            kop="Foto van een kookboek"
            tekst="We lezen 'm uit; de foto zelf bewaren we niet. Het recept blijft van jou alleen."
            onClick={() => { setRoute('prive_kookboek'); setStap('invoer') }}
          />
          <Keuze
            icoon="pencil"
            kop="Typ zelf"
            tekst="In eigen woorden hoe je het maakt. Geen vaste vorm nodig."
            onClick={() => { setRoute('eigen'); setStap('invoer') }}
          />
          <Keuze
            icoon="utensils"
            kop="Laat Pinch een menu samenstellen"
            tekst="Kies een keuken en het aantal personen; Pinch bedenkt de gerechten."
            onClick={() => navigeer('/samenstellen')}
          />
        </Inhoud>
      )}

      {stap === 'invoer' && (
        <Inhoud style={{ gap: 14 }}>
          {kookboek && (
            <Toelichting>
              Dit recept komt uit een kookboek en blijft alleen voor jou zichtbaar. Delen
              kan niet — het boek is niet van jou om te herpubliceren.
            </Toelichting>
          )}
          {route === 'link' && (
            <Toelichting>
              Werkt met openbare posts en reels op Instagram en met receptensites. Het recept
              komt in het Nederlands en met hoeveelheden in grammen; de maker en de link
              staan erbij. Het blijft alleen voor jou zichtbaar.
            </Toelichting>
          )}

          {route === 'link' && (
            <>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="url"
                  inputMode="url"
                  autoCapitalize="none"
                  autoCorrect="off"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="https://www.instagram.com/reel/…"
                  style={{ ...regelStijl, padding: '13px 15px', fontSize: 16 }}
                />
                {typeof navigator !== 'undefined' && navigator.clipboard?.readText && (
                  <button
                    onClick={() => navigator.clipboard.readText().then((t) => { if (t.trim()) setLink(t.trim()) }, () => undefined)}
                    style={{ ...tekstKnop, alignSelf: 'center', flex: 'none', padding: '8px 10px' }}
                  >Plak</button>
                )}
              </div>
              <Button
                tone="purple"
                icon="arrowRight"
                disabled={!linkGeldig}
                onClick={() => { const url = normaliseerUrl(link); if (url) void verwerk((opStap) => leesLink(url, opStap)) }}
                style={{ width: '100%', padding: '17px 24px' }}
              >{linkGeldig && isInstagramUrl(normaliseerUrl(link) ?? '') ? 'Haal het recept van Instagram' : 'Haal het recept op'}</Button>
            </>
          )}

          {route === 'screenshots' && (
            <>
              <input
                ref={bestandKiezer}
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => {
                  const bestanden = [...(e.target.files ?? [])]
                  if (bestanden.length > MAX_SCREENSHOTS) {
                    setFout(`Kies hooguit ${MAX_SCREENSHOTS} screenshots van één recept.`)
                    return
                  }
                  if (bestanden.length > 0) void verwerk((opStap) => leesScreenshots(bestanden, opStap))
                }}
              />
              <Button
                tone="purple"
                icon="grid"
                onClick={() => bestandKiezer.current?.click()}
                style={{ width: '100%', padding: '17px 24px' }}
              >Kies screenshots</Button>
              <p style={uitlegStijl}>
                Staat het recept op meerdere schermen, kies ze dan allemaal tegelijk, in volgorde.
                De screenshots bewaren we niet.
              </p>
            </>
          )}

          {kookboek && (
            <>
              <input
                ref={bestandKiezer}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const bestand = e.target.files?.[0]
                  if (bestand) void verwerk((opStap) => leesFoto(bestand, opStap))
                }}
              />
              <Button
                tone="purple"
                icon="chefHat"
                onClick={() => bestandKiezer.current?.click()}
                style={{ width: '100%', padding: '17px 24px' }}
              >Foto maken of kiezen</Button>
            </>
          )}

          {route === 'eigen' && (
            <>
              <textarea
                value={tekst}
                onChange={(e) => setTekst(e.target.value)}
                rows={9}
                placeholder="Bijvoorbeeld: ui, knoflook en gehakt in de pan, tomatenblokjes erbij, 20 minuten laten sudderen. Voor 4 personen."
                style={{
                  width: '100%', background: 'var(--c-paper)', borderRadius: 14,
                  border: '1.5px solid rgba(20,20,20,0.14)', padding: '14px 16px',
                  fontFamily: 'var(--font-body)', fontSize: 16, lineHeight: 1.5, resize: 'vertical',
                }}
              />
              <Button
                tone="purple"
                disabled={tekst.trim().length < 20}
                onClick={() => void verwerk((opStap) => leesTekst(tekst, opStap))}
                style={{ width: '100%', padding: '17px 24px' }}
              >Laat uitlezen</Button>
            </>
          )}

          <button
            onClick={() => { setConcept(LEEG); setScanId(null); setStap('concept') }}
            style={tekstKnop}
          >Liever zelf invullen</button>
        </Inhoud>
      )}

      {stap === 'bezig' && (
        <Inhoud style={{ alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Icon name="chefHat" size={32} style={{ color: 'var(--c-purple)' }} />
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 700, margin: 0 }}>
            {stapTekst || 'We lezen je recept uit'}
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'rgba(20,20,20,0.6)', margin: 0, textAlign: 'center' }}>
            {route === 'link' ? 'Een video duurt het langst: tot een minuut.' : 'Duurt een paar seconden.'}
          </p>
        </Inhoud>
      )}

      {stap === 'concept' && (
        <>
          <Inhoud style={{ gap: 14 }}>
            <p style={{ ...uitlegStijl, margin: 0 }}>
              Controleer en verbeter waar nodig. Pas na jouw akkoord slaan we het op.
              {' '}Een foto maken we vannacht; morgen staat hij erbij.
            </p>

            {concept.bron?.url && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                background: 'var(--c-paper)', borderRadius: 'var(--radius-sm)', padding: '12px 14px',
                fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.4,
              }}>
                <span>Recept van <strong>{concept.bron.maker ?? siteNaam(concept.bron.url)}</strong></span>
                <a
                  href={concept.bron.url}
                  onClick={(e) => { e.preventDefault(); void openBijWinkel(concept.bron!.url!) }}
                  style={{ ...tekstKnop, padding: 0, whiteSpace: 'nowrap' }}
                >{concept.bron.soort === 'instagram' ? 'Bekijk post' : 'Bekijk'}</a>
              </div>
            )}

            <Veld label="Titel" waarde={concept.titel} onChange={(v) => setConcept({ ...concept, titel: v })} />

            <div style={{ display: 'flex', gap: 10 }}>
              <Veld
                label="Personen" type="number" waarde={String(concept.personen)}
                onChange={(v) => setConcept({ ...concept, personen: Math.max(1, Number(v) || 1) })}
              />
              <Veld
                label="Minuten" type="number" waarde={String(concept.bereidingstijd_minuten ?? '')}
                onChange={(v) => setConcept({ ...concept, bereidingstijd_minuten: Number(v) || undefined })}
              />
            </div>

            <Lijst
              label="Ingrediënten"
              regels={concept.ingredienten.map((i) =>
                [i.hoeveelheid, i.eenheid, i.naam].filter(Boolean).join(' '))}
              onChange={(regels) => setConcept({
                ...concept,
                ingredienten: regels.map(ontleedIngredient),
              })}
              plaatshouder="250 g pasta"
            />

            <Lijst
              label="Bereiding"
              regels={concept.bereiding_nl}
              onChange={(regels) => setConcept({ ...concept, bereiding_nl: regels })}
              plaatshouder="Kook de pasta beetgaar."
              groot
            />

            {magDelen && (
              <label style={{
                display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer',
                background: 'var(--c-paper)', borderRadius: 'var(--radius-md)', padding: 14,
              }}>
                <input
                  type="checkbox" checked={delen} onChange={(e) => setDelen(e.target.checked)}
                  style={{ marginTop: 3, width: 20, height: 20, accentColor: 'var(--c-purple)' }}
                />
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.5 }}>
                  <strong>Aanmelden om te delen</strong><br />
                  <span style={{ color: 'rgba(20,20,20,0.6)' }}>
                    Het recept gaat eerst langs een beoordeling voordat anderen het zien.
                  </span>
                </span>
              </label>
            )}
            {!magDelen && !kookboek && concept.bron && (
              <p style={uitlegStijl}>
                Dit recept is van de maker en blijft alleen voor jou zichtbaar. Je kunt het wel op
                je lijst zetten en bewerken.
              </p>
            )}
          </Inhoud>

          <Voet>
            <Button
              disabled={!concept.titel.trim() || concept.ingredienten.length === 0 || opslaan.isPending}
              onClick={bewaar}
              style={{ width: '100%', padding: '17px 24px', fontSize: 16 }}
            >{opslaan.isPending ? 'Opslaan' : 'Recept opslaan'}</Button>
          </Voet>
        </>
      )}
    </Scherm>
  )
}

/* ------------------------------------------------------------- onderdelen */

function Keuze({ icoon, kop, tekst, onClick }: {
  icoon: string; kop: string; tekst: string; onClick: () => void
}) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 14, width: '100%', textAlign: 'left',
      background: 'var(--c-paper)', border: 'none', borderRadius: 'var(--radius-md)',
      padding: 16, cursor: 'pointer',
    }}>
      <span style={{
        flex: 'none', width: 46, height: 46, borderRadius: 'var(--radius-full)',
        background: 'var(--c-purple)', color: 'var(--c-paper)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}><Icon name={icoon} size={22} /></span>
      <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 700 }}>{kop}</span>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: 1.4, color: 'rgba(20,20,20,0.6)' }}>{tekst}</span>
      </span>
      <Icon name="chevronRight" size={18} style={{ color: 'var(--c-purple)' }} />
    </button>
  )
}

function Toelichting({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--c-yellow)', color: 'var(--c-ink)', borderRadius: 'var(--radius-sm)',
      padding: '14px 16px', fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.5,
    }}>{children}</div>
  )
}

function Veld({ label, waarde, onChange, type = 'text' }: {
  label: string; waarde: string; onChange: (v: string) => void; type?: string
}) {
  return (
    <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700 }}>{label}</span>
      <input
        type={type} value={waarde} onChange={(e) => onChange(e.target.value)}
        style={{
          background: 'var(--c-paper)', border: '1.5px solid rgba(20,20,20,0.14)',
          borderRadius: 14, padding: '13px 15px', fontFamily: 'var(--font-body)', fontSize: 16,
          width: '100%', minWidth: 0,
        }}
      />
    </label>
  )
}

function Lijst({ label, regels, onChange, plaatshouder, groot }: {
  label: string
  regels: string[]
  onChange: (regels: string[]) => void
  plaatshouder: string
  groot?: boolean
}) {
  const zichtbaar = regels.length > 0 ? regels : ['']
  const zet = (i: number, waarde: string) => {
    const nieuw = [...zichtbaar]
    nieuw[i] = waarde
    onChange(nieuw.filter((r, n) => r.trim() || n === i))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700 }}>{label}</span>
      {zichtbaar.map((regel, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          {groot ? (
            <textarea
              value={regel} onChange={(e) => zet(i, e.target.value)} placeholder={plaatshouder} rows={2}
              style={regelStijl}
            />
          ) : (
            <input value={regel} onChange={(e) => zet(i, e.target.value)} placeholder={plaatshouder} style={regelStijl} />
          )}
          <button
            onClick={() => onChange(zichtbaar.filter((_, n) => n !== i))}
            aria-label="Regel verwijderen"
            style={{
              flex: 'none', width: 32, height: 32, marginTop: 6, border: 'none',
              background: 'transparent', color: 'rgba(20,20,20,0.45)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          ><Icon name="x" size={14} /></button>
        </div>
      ))}
      <button onClick={() => onChange([...zichtbaar, ''])} style={tekstKnop}>+ Regel toevoegen</button>
    </div>
  )
}

const regelStijl: React.CSSProperties = {
  flex: 1, minWidth: 0, background: 'var(--c-paper)', border: '1.5px solid rgba(20,20,20,0.14)',
  borderRadius: 14, padding: '12px 15px', fontFamily: 'var(--font-body)', fontSize: 16,
  lineHeight: 1.4, resize: 'vertical',
}

const uitlegStijl: React.CSSProperties = {
  fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.5, margin: 0, color: 'rgba(20,20,20,0.6)',
}

const tekstKnop: React.CSSProperties = {
  alignSelf: 'flex-start', background: 'transparent', border: 'none', padding: '8px 2px',
  cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700,
  color: 'var(--c-purple)',
}

/** "250 g pasta" → {hoeveelheid: '250', eenheid: 'g', naam: 'pasta'} */
function ontleedIngredient(regel: string) {
  const match = regel.trim().match(/^([\d.,/]+)?\s*(g|gr|kg|ml|l|el|tl|stuks?|teentjes?|snufje)?\s*(.*)$/i)
  if (!match) return { hoeveelheid: null, eenheid: null, naam: regel.trim() }
  const [, hoeveelheid, eenheid, naam] = match
  return {
    hoeveelheid: hoeveelheid?.replace(',', '.') ?? null,
    eenheid: eenheid?.toLowerCase() ?? null,
    naam: naam.trim() || regel.trim(),
  }
}
