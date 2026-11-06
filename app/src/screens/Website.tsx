import type { CSSProperties, ReactNode } from 'react'
import { Icon, Woordmerk } from '../ds'
import { t } from '../lib/taal'
import { APPSTORE_URL, GOOGLE_PLAY_BESCHIKBAAR, PRIVACY_URL, VOORWAARDEN_URL } from '../lib/config'
import aubergine from '../assets/website/aubergine-traybake.jpg'
import goddess from '../assets/website/green-goddess.jpg'
import tacos from '../assets/website/tacos-kip.jpg'
import tonijn from '../assets/website/tonijn-couscous.jpg'

/**
 * De openbare website (kookmaatje.eu): wat je ziet als je niet bent ingelogd
 * en de app in een gewone browser opent. Naar het ontwerp "Kookmaatje
 * Website" uit Claude Design. De telefoons zijn nagebouwde schermen, geen
 * schermafbeeldingen, zodat ze scherp blijven.
 *
 * De app staat voorop: de App Store-knop is de hoofdactie. Inloggen kan wel,
 * voor wie Kookmaatje op een laptop wil gebruiken.
 */
export function Website({ onInloggen }: { onInloggen: () => void }) {
  const inloggen = (e: { preventDefault: () => void }) => {
    e.preventDefault()
    onInloggen()
  }
  return (
    // De app zelf scrollt nooit (ds/styles.css); de website wel, in dit vlak.
    <div className="ws" style={{ height: '100%', overflowY: 'auto', background: 'var(--k-cream)', color: 'var(--k-ink)', fontFamily: 'var(--font-body)' }}>
      <style>{CSS}</style>

      <header style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--k-cream)', color: 'var(--k-purple)', borderBottom: '1px solid var(--k-purple-100)' }}>
        <div style={{ ...BREED, padding: '20px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <Woordmerk hoogte={24} korrel="var(--k-yellow)" />
          <nav style={{ display: 'flex', alignItems: 'center', gap: 24, fontSize: 14, fontWeight: 700 }}>
            <a className="ws-navlink" href="#hoe">{t('Zo werkt het')}</a>
            <a className="ws-navlink" href="#waarom">{t('Waarom')}</a>
            <a href="/inloggen" onClick={inloggen} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--k-purple)', color: 'var(--k-cream)', borderRadius: 9999, padding: '10px 18px' }}>
              <Icon name="user" size={16} /><span>{t('Inloggen')}</span>
            </a>
          </nav>
        </div>
      </header>

      <section style={{ background: 'var(--k-cream)', overflow: 'hidden' }}>
        <div style={{ ...BREED, padding: '48px 28px 0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,420px),1fr))', gap: 48, alignItems: 'center' }}>
          <div style={{ paddingBottom: 56, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <span style={LABEL_PAARS}>{t('Kookmaatje of maaltijdbox?')}</span>
            <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 'clamp(30px,3.8vw,48px)', lineHeight: 0.95, hyphens: 'none', textTransform: 'uppercase', letterSpacing: '-.01em', color: 'var(--k-purple)' }}>
              {t('Elke week dezelfde dure maaltijdbox?')}
            </h1>
            <p style={{ margin: 0, maxWidth: '30em', fontSize: 18, lineHeight: 1.55, textWrap: 'pretty' }}>
              {t('Neem zelf weer de controle: bespaar geld en eet veelzijdiger. Zoek in 600 recepten en bestel met 1 klik bij je supermarkt.')}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16, marginTop: 8 }}>
              <AppStoreKnop />
              {GOOGLE_PLAY_BESCHIKBAAR === false && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1.5px dashed rgba(43,20,32,.3)', color: 'var(--k-ink-500)', borderRadius: 12, padding: '12px 16px', fontSize: 14, fontWeight: 700 }}>
                  {t('Google Play komt eraan')}
                </span>
              )}
            </div>
            <span style={{ fontSize: 14, color: 'var(--k-ink-500)' }}>
              {t('Liever op je laptop?')} <a href="/inloggen" onClick={inloggen} style={{ textDecoration: 'underline' }}>{t('Log in')}</a> {t('en gebruik Kookmaatje in je browser.')}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 56 }}>
            <Telefoon>
              <KopScherm eyebrow={t('Mijn recepten')} titel={t('Wat eet jij hierna?')} sub={t('4 nog te bestellen · voor 4 personen')} />
              <div style={{ flex: 'none', display: 'flex', gap: 8, padding: '12px 22px 4px', overflow: 'hidden' }}>
                <Chip>{t('Te koken')}</Chip>
                <Chip aan>{t('Nog bestellen')}</Chip>
                <Chip>{t('Eerder gekookt')}</Chip>
              </div>
              <div style={{ flex: 1, overflow: 'hidden', padding: '8px 22px 16px' }}>
                <div style={{ paddingBottom: 10 }}><TelLabel>{t('4 nog te bestellen')}</TelLabel></div>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 12 }}>
                  <Kaart titel={t('Aubergine-traybake')} foto={aubergine} minuten={55} bonus opLijst />
                  <Kaart titel={t('Green goddess-salade met groene groenten')} foto={goddess} minuten={40} bonus />
                  <Kaart titel={t("Taco's met kip en gegrilde ananassalsa")} foto={tacos} minuten={50} />
                  <Kaart titel={t('Tonijn-couscoussalade')} foto={tonijn} minuten={20} bonus />
                </div>
              </div>
              <Tabbalk actief="mijn-recepten" tellers={{ 'mijn-recepten': 4, lijst: 9 }} />
            </Telefoon>
          </div>
        </div>
      </section>

      <section id="waarom" style={{ ...BREED, padding: '96px 28px 56px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,380px),1fr))', gap: 64, alignItems: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Telefoon>
            <div style={{ flex: 'none', background: 'var(--k-purple)', color: 'var(--k-cream)', padding: '62px 22px 14px' }}>
              <Eyebrow>{t('3 recepten')}</Eyebrow>
              <h2 style={{ margin: '14px 0 0', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 28, lineHeight: 0.94, textTransform: 'uppercase' }}>{t('Boodschappen')}</h2>
              <p style={{ fontSize: 14, lineHeight: 1.5, margin: '10px 0 0' }}>{t('10 van de 11 producten nog nodig · op volgorde van de winkel')}</p>
            </div>
            <div style={{ flex: 1, overflow: 'hidden', padding: '16px 22px 8px', display: 'flex', flexDirection: 'column', gap: 18 }}>
              <Afdeling naam={t('Groente & fruit')} regels={[[t('300 g spinazie')], [t('1 flespompoen')], [t('1 bos basilicum'), true], [t('2 citroenen')]]} />
              <Afdeling naam={t('Pasta & rijst')} regels={[[t('500 g tortellini'), false, t('Bonus: 2e halve prijs t/m zondag')], [t('1 blik kikkererwten')]]} />
              <Afdeling naam={t('Zuivel')} regels={[[t('250 g ricotta')]]} />
            </div>
            <div style={{ flex: 'none', padding: '12px 22px 14px', borderTop: '1.5px solid rgba(43,20,32,.12)', background: 'var(--k-cream)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--k-purple)', color: 'var(--k-cream)', borderRadius: 9999, minHeight: 52, fontWeight: 700, fontSize: 16 }}>{t('Naar AH-mandje (10)')}</div>
              <p style={{ fontSize: 12, lineHeight: 1.4, margin: '8px 0 0', textAlign: 'center', color: 'var(--k-ink-500)' }}>{t('Afgevinkte producten laten we uit je mandje.')}</p>
            </div>
            <Tabbalk actief="lijst" tellers={{ 'mijn-recepten': 3, lijst: 10 }} />
          </Telefoon>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span style={LABEL_GRIJS}>{t('Waarom Kookmaatje')}</span>
            <h2 style={KOP2}>{t('Goedkoper, veelzijdiger en lekkerder koken')}</h2>
          </div>
          <Voordeel icoon="piggyBank" kop={t('Goedkoper')}>
            {t('Je kookt met gewone boodschappen uit je eigen supermarkt, dus je betaalt geen opslag zoals bij een maaltijdbox. Je koopt alleen wat je recepten nodig hebben en ziet bonusaanbiedingen meteen op je lijst.')}
          </Voordeel>
          <Voordeel icoon="shuffle" kop={t('Veelzijdiger')}>
            {t('600 recepten uit alle keukens, plus je eigen. Plak een link, upload screenshots of maak een foto van je kookboek. Wij halen het recept eruit, vertalen het en rekenen het om.')}
          </Voordeel>
          <Voordeel icoon="chefHat" kop={t('Lekkerder')}>
            {t('Kookmodus neemt je stap voor stap mee, met de juiste hoeveelheden voor jouw huishouden. Geef elk gerecht een cijfer, dan weet je wat je nog eens kookt.')}
          </Voordeel>
          <Voordeel icoon="utensils" kop={t('Iets over?')}>
            {t('Vertel Kookmaatje wat je nog in huis hebt, en hij stelt een gerecht samen. Maximaal besparen!')}
          </Voordeel>
        </div>
      </section>

      <section id="vergelijk" style={{ ...BREED, padding: '40px 28px 56px', display: 'flex', flexDirection: 'column', gap: 32 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span style={LABEL_GRIJS}>{t('Kookmaatje of maaltijdbox')}</span>
          <h2 style={{ ...KOP2, maxWidth: '20em' }}>{t('Hetzelfde gemak, de helft van de prijs')}</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,320px),1fr))', gap: 12 }}>
          <Vergelijking
            naam={t('Maaltijdbox')} prijs="€6 – 8" eenheid={t('per portie')}
            punten={[t('Een vaste selectie recepten per week'), t('Elk ingrediënt apart verpakt'), t('Je betaalt ook voor wat je al in huis hebt'), t('Alleen recepten uit hun eigen menu')]}
          />
          <Vergelijking
            kookmaatje naam="Kookmaatje" prijs="€3 – 4" eenheid={t('per portie, met boodschappen uit je eigen supermarkt')}
            punten={[t('Kies uit 600 recepten, of creëer zelf'), t('Gewoon in je AH- of Jumbo-mandje, met bonus'), t('Producten uit eigen voorraad worden niet besteld'), t('Eigen recepten maken, verzamelen, bewaren')]}
          />
        </div>
        <span style={{ fontSize: 13, color: 'var(--k-ink-500)' }}>{t('Indicatie per portie bij 4 personen. Wat je betaalt hangt af van je recepten en je supermarkt.')}</span>
      </section>

      <section id="hoe" style={{ ...BREED, padding: '40px 28px 96px', display: 'flex', flexDirection: 'column', gap: 40 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span style={LABEL_GRIJS}>{t('Zo werkt het')}</span>
          <h2 style={{ ...KOP2, maxWidth: '18em' }}>{t('Van recept tot bord, in een handomdraai')}</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
          <Stap nr="1" kop={t('Kies je recepten')}>{t('Uit 600 recepten in Ontdekken, of je eigen: plak een link van Instagram, TikTok of een website.')}</Stap>
          <Stap nr="2" kop={t('Eén lijst, op schapvolgorde')}>{t('Alle ingrediënten opgeteld en gesorteerd zoals de supermarkt is ingedeeld.')}</Stap>
          <Stap nr="3" kop={t('Naar je mandje')}>{t('Met één tik in je AH- of Jumbo-mandje. Of shop bij je lokale supermarkt. Wat je al in huis hebt vink je af.')}</Stap>
          <Stap nr="4" kop={t('Koken, stap voor stap')}>{t('Kookmodus laat je elke stap zien, met hoeveelheden voor jouw huishouden.')}</Stap>
        </div>
      </section>

      <section id="verhaal" style={{ ...BREED, padding: '0 28px 96px' }}>
        <div style={{ background: 'var(--k-paper)', borderRadius: 24, padding: 'clamp(28px,5vw,56px)', display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 760, margin: '0 auto' }}>
          <span style={LABEL_GRIJS}>{t('Mijn verhaal')}</span>
          <h2 style={{ ...KOP2, maxWidth: '16em' }}>{t('Altijd dezelfde vier gerechten')}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: 18, lineHeight: 1.6, textWrap: 'pretty' }}>
            <p style={{ margin: 0 }}>
              {t('Ik was na een paar jaar een maaltijdbox een beetje klaar met altijd dezelfde gerechten. Shakshuka, orzo met paddenstoelen, de boekoeloekoeburger, en een pasta met garnalen.')}
            </p>
            <p style={{ margin: 0 }}>
              {t('Ik hou van koken, en wil wat meer zelf bepalen wat ik eet. Gevarieerder, lekkerder, en waar ik op dat moment zin in heb. Maar wel met het gemak van een box, en liefst ook nog goedkoper!')}
            </p>
            <p style={{ margin: 0 }}>
              {t('Dat is nu allemaal gelukt, met mijn Kookmaatje. Ik kies weer zelf, ik bespaar elke week, het hele gezin eet lekkerder. Ik kan ook nog gaandeweg alle lekkere recepten die ik tegenkom toevoegen aan mijn app. Iedereen blij!')}
            </p>
            <p style={{ margin: 0, fontWeight: 700, color: 'var(--k-purple)' }}>
              {t('Herken je dit? Download de app (gratis)!')}
            </p>
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18, textTransform: 'uppercase', color: 'var(--k-purple)' }}>Reinoud</span>
        </div>
      </section>

      <section style={{ background: 'var(--k-purple)', color: 'var(--k-cream)' }}>
        <div style={{ ...BREED, padding: '88px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 24 }}>
          <Woordmerk hoogte={44} korrel="var(--k-yellow)" />
          <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 'clamp(34px,5vw,56px)', lineHeight: 0.9, textTransform: 'uppercase', maxWidth: '12em' }}>{t('Wat eet jij deze week?')}</h2>
          <p style={{ margin: 0, fontSize: 18, lineHeight: 1.5, maxWidth: '28em' }}>{t('Download Kookmaatje gratis en zet je eerste recepten op je lijst.')}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 16 }}>
            <AppStoreKnop opPaars />
            {GOOGLE_PLAY_BESCHIKBAAR === false && (
              <span style={{ display: 'flex', alignItems: 'center', border: '1.5px dashed rgba(248,241,236,.5)', borderRadius: 12, padding: '12px 16px', fontSize: 14, fontWeight: 700 }}>
                {t('Google Play komt eraan')}
              </span>
            )}
          </div>
        </div>
      </section>

      <footer style={{ ...BREED, padding: '32px 28px 40px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16, fontSize: 14, color: 'var(--k-ink-500)' }}>
        <span style={{ color: 'var(--k-purple)' }}><Woordmerk hoogte={18} korrel="var(--k-yellow)" /></span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
          <a href={VOORWAARDEN_URL}>{t('Voorwaarden')}</a>
          <a href={PRIVACY_URL}>Privacy</a>
          <a href="mailto:support@kookmaatje.eu">{t('Contact')}</a>
          <span>© 2026 Kookmaatje</span>
        </div>
      </footer>
    </div>
  )
}

/* ------------------------------------------------------------- Bouwstenen */

const BREED: CSSProperties = { maxWidth: 1160, margin: '0 auto' }
const LABEL_PAARS: CSSProperties = { fontSize: 12, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--k-purple)' }
const LABEL_GRIJS: CSSProperties = { ...LABEL_PAARS, color: 'var(--k-ink-500)' }
const KOP2: CSSProperties = { margin: 0, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 'clamp(26px,3.2vw,38px)', lineHeight: 1.1, textTransform: 'uppercase' }

// Het ontwerp rekent met --k-*; de app heet dezelfde kleuren --c-*. Hier alleen
// de vertaling, zodat de rest van de app niet verandert.
const CSS = `
.ws{--k-purple:var(--c-red);--k-purple-700:var(--c-red-700);--k-purple-100:var(--c-red-100);
--k-yellow:var(--c-yellow);--k-cream:var(--c-cream);--k-paper:var(--c-paper);
--k-ink:var(--c-ink);--k-ink-500:var(--c-ink-500);--k-ink-300:var(--c-ink-300)}
.ws a{text-decoration:none}
.ws a:hover{color:inherit}
.ws-navlink{color:var(--k-purple)}
.ws-navlink:hover{color:var(--k-purple-700)}
@media (max-width:560px){.ws-navlink{display:none}}
`

function AppStoreKnop({ opPaars }: { opPaars?: boolean }) {
  return (
    <a
      href={APPSTORE_URL} aria-label={t('Download in de App Store')}
      style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#000', color: '#fff', borderRadius: 12, padding: '9px 18px 9px 14px', border: opPaars ? '1.5px solid rgba(248,241,236,.5)' : undefined }}
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
        <path d="M16.37 12.6c-.02-2.3 1.88-3.4 1.97-3.46-1.07-1.57-2.74-1.78-3.33-1.8-1.42-.14-2.77.83-3.49.83-.72 0-1.83-.81-3.01-.79-1.55.02-2.98.9-3.78 2.29-1.61 2.8-.41 6.94 1.16 9.21.77 1.11 1.68 2.36 2.88 2.31 1.16-.05 1.6-.75 3-.75s1.79.75 3.01.72c1.24-.02 2.03-1.13 2.79-2.25.88-1.29 1.24-2.54 1.26-2.6-.03-.01-2.42-.93-2.46-3.71zM14.08 5.85c.64-.77 1.07-1.85.95-2.92-.92.04-2.03.61-2.69 1.38-.59.68-1.11 1.78-.97 2.83 1.02.08 2.07-.52 2.71-1.29z" />
      </svg>
      <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1, textAlign: 'left' }}>
        <span style={{ fontSize: 11 }}>{t('Download in de')}</span>
        <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.01em' }}>App Store</span>
      </span>
    </a>
  )
}

function Voordeel({ icoon, kop, children }: { icoon: string; kop: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
      <span style={{ flex: 'none', width: 48, height: 48, borderRadius: 9999, background: 'var(--k-purple)', color: 'var(--k-cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icoon} size={22} />
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 20, textTransform: 'uppercase' }}>{kop}</h3>
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.5, color: 'var(--k-ink-500)', textWrap: 'pretty' }}>{children}</p>
      </div>
    </div>
  )
}

function Vergelijking({ naam, prijs, eenheid, punten, kookmaatje }: {
  naam: string; prijs: string; eenheid: string; punten: string[]; kookmaatje?: boolean
}) {
  return (
    <div style={{ background: kookmaatje ? 'var(--k-purple)' : 'var(--k-paper)', color: kookmaatje ? 'var(--k-cream)' : undefined, borderRadius: 16, padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ ...LABEL_GRIJS, color: kookmaatje ? 'var(--k-yellow)' : 'var(--k-ink-500)' }}>{naam}</span>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 40, lineHeight: 1.1, color: kookmaatje ? undefined : 'var(--k-ink)' }}>{prijs}</span>
        <span style={{ fontSize: 14, color: kookmaatje ? undefined : 'var(--k-ink-500)' }}>{eenheid}</span>
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {punten.map((p) => (
          <li key={p} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', fontSize: 16, lineHeight: 1.5, color: kookmaatje ? undefined : 'var(--k-ink-500)' }}>
            <span style={{ flex: 'none', width: 24, height: 24, borderRadius: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: kookmaatje ? 'var(--k-yellow)' : 'rgba(43,20,32,.08)', color: kookmaatje ? 'var(--k-ink)' : 'var(--k-ink-500)' }}>
              <Icon name={kookmaatje ? 'check' : 'x'} size={14} />
            </span>
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Stap({ nr, kop, children }: { nr: string; kop: string; children: ReactNode }) {
  return (
    <div style={{ background: 'var(--k-paper)', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 32, color: 'var(--k-purple)' }}>{nr}</span>
      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{kop}</h3>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: 'var(--k-ink-500)' }}>{children}</p>
    </div>
  )
}

/* ----------------------------------------------------- Nagebouwde telefoon */

/**
 * Een iPhone van 402 × 874 pt, op 82% geschaald. De schermen erin zijn
 * vereenvoudigde versies van MijnRecepten en Boodschappen: wat ze tonen is
 * vast, ze lezen niets uit de database.
 */
function Telefoon({ children, zonderRand }: { children: ReactNode; zonderRand?: boolean }) {
  return (
    <div
      aria-hidden="true"
      style={{
        boxSizing: 'content-box', width: 330, height: 717, overflow: 'hidden', flex: 'none',
        padding: zonderRand ? 0 : 9, background: zonderRand ? 'transparent' : 'var(--k-ink)', borderRadius: 48,
      }}
    >
      <div style={{ width: 402, height: 874, transform: 'scale(.82)', transformOrigin: 'top left', position: 'relative', borderRadius: 48, overflow: 'hidden', background: 'var(--k-ink)', padding: zonderRand ? 0 : 0 }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--k-cream)', borderRadius: 48, overflow: 'hidden' }}>
          {children}
        </div>
        <Statusbalk />
      </div>
    </div>
  )
}

function Statusbalk() {
  return (
    <>
      <div style={{ position: 'absolute', top: 11, left: '50%', marginLeft: -62, width: 124, height: 36, borderRadius: 20, background: '#000', zIndex: 5 }} />
      <div style={{ position: 'absolute', top: 18, left: 38, zIndex: 5, color: 'var(--k-cream)', fontWeight: 600, fontSize: 17 }}>9:41</div>
      <div style={{ position: 'absolute', top: 22, right: 34, zIndex: 5, display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ width: 26, height: 12, borderRadius: 4, border: '1.5px solid rgba(248,241,236,.6)', padding: 1.5 }}>
          <span style={{ display: 'block', width: '100%', height: '100%', borderRadius: 2, background: 'var(--k-cream)' }} />
        </span>
      </div>
    </>
  )
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 12, lineHeight: '15px', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--k-yellow)' }}>{children}</div>
}

function KopScherm({ eyebrow, titel, sub }: { eyebrow: string; titel: string; sub: string }) {
  return (
    <div style={{ flex: 'none', background: 'var(--k-purple)', color: 'var(--k-cream)', padding: '62px 22px 14px' }}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 style={{ margin: '6px 0 0', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 22, lineHeight: 0.94, textTransform: 'uppercase' }}>{titel}</h2>
      <p style={{ fontSize: 13, lineHeight: 1.4, margin: '6px 0 0' }}>{sub}</p>
    </div>
  )
}

function Chip({ children, aan }: { children: ReactNode; aan?: boolean }) {
  return (
    <span style={{ flex: 'none', fontSize: 12, lineHeight: '16px', padding: '8px 16px', borderRadius: 9999, whiteSpace: 'nowrap', border: aan ? '1.5px solid transparent' : '1.5px solid var(--k-ink)', background: aan ? 'var(--k-purple)' : 'transparent', color: aan ? 'var(--k-cream)' : 'var(--k-ink)' }}>
      {children}
    </span>
  )
}

function TelLabel({ children, kleur = 'var(--k-ink-500)' }: { children: ReactNode; kleur?: string }) {
  return <span style={{ fontSize: 12, lineHeight: '15px', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: kleur }}>{children}</span>
}

function Kaart({ titel, foto, minuten, bonus, opLijst }: { titel: string; foto: string; minuten: number; bonus?: boolean; opLijst?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderRadius: 20, padding: 4, background: opLijst ? 'var(--k-yellow)' : 'transparent' }}>
      <div style={{ flex: 1, position: 'relative', display: 'flex' }}>
        {bonus && (
          <span style={{ position: 'absolute', zIndex: 1, left: 8, bottom: 8, borderRadius: 9999, padding: '4px 9px', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', background: 'var(--k-yellow)', color: 'var(--k-ink)', boxShadow: '0 1px 4px rgba(43,20,32,.18)' }}>{t('Bonus')}</span>
        )}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--k-purple)', borderRadius: 'var(--radius-md)', overflow: 'hidden', color: 'var(--k-paper)', textAlign: 'left' }}>
          <div style={{ width: '100%', aspectRatio: '4 / 3', flex: 'none', background: `url(${foto}) center/cover` }} />
          <div style={{ padding: '10px 12px 12px', width: '100%' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13, lineHeight: 1, margin: 0, textTransform: 'uppercase', minHeight: '2em', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{titel}</h3>
            <div style={{ display: 'flex', gap: 12, marginTop: 6, opacity: 0.85 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}><Icon name="clock" size={13} />{minuten} {t('min')}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}><Icon name="users" size={13} />4</span>
            </div>
          </div>
        </div>
        <span style={{ position: 'absolute', top: 10, right: 10, width: 32, height: 32, borderRadius: 9999, background: 'rgba(43,20,32,.34)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--k-paper)' }}>
          <Icon name="x" size={16} />
        </span>
      </div>
      <div style={{ margin: '0 4px 4px' }}>
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 36, borderRadius: 9999, fontSize: 13, fontWeight: 700, background: 'var(--k-paper)', color: 'var(--k-purple)', border: opLijst ? '1.5px solid var(--k-purple)' : '1.5px solid rgba(43,20,32,.14)' }}>
          <Icon name={opLijst ? 'check' : 'plus'} size={15} />{opLijst ? t('Op je lijst') : t('Zet op je lijst')}
        </span>
      </div>
    </div>
  )
}

function Afdeling({ naam, regels }: { naam: string; regels: [string, boolean?, string?][] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ paddingBottom: 6 }}><TelLabel kleur="var(--k-purple)">{naam}</TelLabel></div>
      {regels.map(([tekst, af, bonus]) => (
        <div key={tekst} style={{ padding: '10px 2px', borderBottom: '1.5px solid rgba(43,20,32,.12)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 24, height: 24, borderRadius: 'var(--radius-sm)', border: af ? 'none' : '1.5px solid var(--k-ink)', background: af ? 'var(--k-purple)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', color: 'var(--k-cream)' }}>
              {af && <Icon name="check" size={14} />}
            </span>
            <span style={{ fontSize: 16, color: af ? 'var(--k-ink-300)' : 'var(--k-ink)', textDecoration: af ? 'line-through' : 'none' }}>{tekst}</span>
          </div>
          {bonus && <span style={{ display: 'block', marginLeft: 36, marginTop: 3, fontSize: 12, fontWeight: 700, color: 'var(--k-purple)' }}>{bonus}</span>}
        </div>
      ))}
    </div>
  )
}

const TABS = [
  { id: 'mijn-recepten', icoon: 'house', label: 'Mijn recepten' },
  { id: 'ontdekken', icoon: 'grid', label: 'Ontdekken' },
  { id: 'lijst', icoon: 'cart', label: 'Lijst' },
  { id: 'profiel', icoon: 'user', label: 'Profiel' },
]

function Tabbalk({ actief, tellers }: { actief: string; tellers: Record<string, number> }) {
  return (
    <div style={{ flex: 'none', display: 'flex', justifyContent: 'space-around', background: 'var(--k-paper)', borderTop: '1px solid var(--k-purple-100)', padding: '10px 0 28px' }}>
      {TABS.map((tab) => (
        <div key={tab.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '4px 14px', color: actief === tab.id ? 'var(--k-purple)' : 'var(--k-ink-300)' }}>
          <span style={{ position: 'relative', display: 'flex' }}>
            <Icon name={tab.icoon} size={22} />
            {tellers[tab.id] > 0 && (
              <span style={{ position: 'absolute', top: -6, right: -12, display: 'inline-block', minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9999, background: 'var(--k-yellow)', color: 'var(--k-ink)', fontSize: 11, fontWeight: 700, lineHeight: '15px', textAlign: 'center', border: '1.5px solid var(--k-paper)' }}>{tellers[tab.id]}</span>
            )}
          </span>
          <span style={{ fontSize: 11 }}>{t(tab.label)}</span>
        </div>
      ))}
    </div>
  )
}
