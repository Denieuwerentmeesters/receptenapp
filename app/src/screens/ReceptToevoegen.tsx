import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Icon } from '../ds'
import { Inhoud, Kop, Label, Scherm, Titel, Voet } from '../components/Layout'
import { foutTekst } from '../lib/fouten'
import { extractieBeschikbaar, leesFoto, leesTekst, type Concept } from '../lib/extractie'
import { useReceptOpslaan } from '../lib/queries2'
import type { BronType } from '../lib/database.types'

type Stap = 'kiezen' | 'invoer' | 'bezig' | 'concept'

/**
 * Waar het recept vandaan komt bepaalt wat ermee mag.
 *
 *  prive_kookboek — foto van een kookboekpagina, blijft altijd van jou alleen.
 *  eigen          — je eigen bedenksel, mag je aanmelden om te delen.
 */
type Route = 'prive_kookboek' | 'eigen'

const LEEG: Concept = {
  titel: '', personen: 4, tags: [], ingredienten: [], bereiding_nl: [],
}

/**
 * Recept toevoegen (plan §7).
 *
 * Twee routes: een foto van een kookboekpagina, of je eigen recept in vrije
 * tekst. Beide komen uit op hetzelfde conceptscherm waar jij controleert wat
 * eruit kwam — OCR is niet feilloos en het model doet soms een verkeerde
 * aanname over een hoeveelheid.
 *
 * De kookboekfoto wordt gebruikt om uit te lezen en daarna weggegooid, niet
 * opgeslagen. Dat scheelt opslag en het is ook precies wat je wil: de pagina uit
 * een boek van iemand anders hoeft nergens te blijven staan.
 */
export function ReceptToevoegen() {
  const navigeer = useNavigate()
  const opslaan = useReceptOpslaan()

  const [stap, setStap] = useState<Stap>('kiezen')
  const [route, setRoute] = useState<Route>('eigen')
  const [tekst, setTekst] = useState('')
  const [concept, setConcept] = useState<Concept>(LEEG)
  const [delen, setDelen] = useState(false)
  const [fout, setFout] = useState('')
  const bestandKiezer = useRef<HTMLInputElement>(null)

  const bron: BronType = route === 'prive_kookboek' ? 'kookboek_foto' : 'eigen_input'
  const kookboek = route === 'prive_kookboek'

  async function verwerk(actie: () => Promise<Concept>) {
    setStap('bezig'); setFout('')
    try {
      setConcept(await actie())
      setStap('concept')
    } catch (f) {
      setFout(foutTekst(f))
      setStap('invoer')
    }
  }

  function bewaar() {
    opslaan.mutate(
      {
        concept,
        bronType: bron,
        // Kookboekrecepten kunnen nooit gedeeld worden (plan §7.3) — hier én in
        // de database afgedwongen met een check-constraint.
        deelStatus: kookboek ? 'prive' : delen ? 'aangevraagd' : 'prive',
      },
      {
        onSuccess: (id) => navigeer(`/recept/${id}`),
        onError: (f) => setFout(foutTekst(f)),
      },
    )
  }

  return (
    <Scherm>
      <Kop kleur="var(--c-purple)" style={{ paddingBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => (stap === 'kiezen' ? navigeer(-1) : setStap('kiezen'))}
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
          <Titel grootte={26}>
            {stap === 'kiezen' ? 'Waar komt het vandaan?'
              : stap === 'concept' ? 'Klopt dit?'
              : kookboek ? 'Uit je kookboek' : 'Je eigen recept'}
          </Titel>
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
            icoon="chefHat"
            kop="Maak een foto van een recept"
            tekst="We lezen 'm uit; de foto zelf bewaren we niet. Het recept komt in jouw omgeving, maar mag niet gedeeld worden."
            onClick={() => { setRoute('prive_kookboek'); setStap('invoer') }}
          />
          <Keuze
            icoon="pencil"
            kop="Maak een eigen recept"
            tekst="Typ in eigen woorden hoe je het maakt. Geen vaste vorm nodig."
            onClick={() => { setRoute('eigen'); setStap('invoer') }}
          />
        </Inhoud>
      )}

      {stap === 'invoer' && (
        <>
          <Inhoud style={{ gap: 14 }}>
            {kookboek && (
              <div style={{
                background: 'var(--c-yellow)', color: 'var(--c-ink)', borderRadius: 'var(--radius-sm)',
                padding: '14px 16px', fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.5,
              }}>
                Dit recept komt uit een kookboek en blijft alleen voor jou zichtbaar. Delen
                kan niet — het boek is niet van jou om te herpubliceren.
              </div>
            )}

            {extractieBeschikbaar() ? (
              <>
                {kookboek ? (
                  <>
                    <input
                      ref={bestandKiezer}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const bestand = e.target.files?.[0]
                        if (bestand) void verwerk(() => leesFoto(bestand))
                      }}
                    />
                    <Button
                      tone="purple"
                      icon="chefHat"
                      onClick={() => bestandKiezer.current?.click()}
                      style={{ width: '100%', padding: '17px 24px' }}
                    >Foto maken of kiezen</Button>
                  </>
                ) : (
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
                      onClick={() => void verwerk(() => leesTekst(tekst))}
                      style={{ width: '100%', padding: '17px 24px' }}
                    >Laat uitlezen</Button>
                  </>
                )}
                <button
                  onClick={() => { setConcept(LEEG); setStap('concept') }}
                  style={tekstKnop}
                >Liever zelf invullen</button>
              </>
            ) : (
              <>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.5, margin: 0 }}>
                  Automatisch uitlezen staat nog niet aan. Je kunt het recept wel zelf invullen.
                </p>
                <Button tone="purple" onClick={() => { setConcept(LEEG); setStap('concept') }}
                  style={{ width: '100%', padding: '17px 24px' }}>Zelf invullen</Button>
              </>
            )}
          </Inhoud>
        </>
      )}

      {stap === 'bezig' && (
        <Inhoud style={{ alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Icon name="chefHat" size={32} style={{ color: 'var(--c-purple)' }} />
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 700, margin: 0 }}>
            We lezen je recept uit
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'rgba(20,20,20,0.6)', margin: 0 }}>
            Duurt een paar seconden.
          </p>
        </Inhoud>
      )}

      {stap === 'concept' && (
        <>
          <Inhoud style={{ gap: 14 }}>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.5, margin: 0, color: 'rgba(20,20,20,0.6)' }}>
              Controleer en verbeter waar nodig. Pas na jouw akkoord slaan we het op.
            </p>

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

            {!kookboek && (
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
  borderRadius: 14, padding: '12px 15px', fontFamily: 'var(--font-body)', fontSize: 15,
  lineHeight: 1.4, resize: 'vertical',
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
