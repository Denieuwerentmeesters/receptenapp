import { describe, expect, it } from 'vitest'
import { canoniekeUrl, duurInMinuten, leesReceptBlok, receptBlokAlsTekst, siteNaamUit, zichtbareTekst } from '../../../lib/extractie/website'

const PAGINA = `<!doctype html><html><head>
<meta property="og:site_name" content="Uit Pauline&#39;s Keuken">
<link rel="canonical" href="/recept/pasta-pesto/">
<script type="application/ld+json">
{"@context":"https://schema.org","@graph":[{"@type":"WebPage","name":"x"},{"@type":["Recipe"],
 "name":"Pasta pesto","recipeYield":"4 personen","totalTime":"PT25M","recipeCuisine":"Italiaans",
 "author":{"@type":"Person","name":"Pauline"},"keywords":"pasta, snel",
 "recipeIngredient":["300 g penne","1 potje pesto","50 g pijnboompitten"],
 "recipeInstructions":[{"@type":"HowToSection","name":"Koken","itemListElement":[{"@type":"HowToStep","text":"Kook de pasta."}]},{"@type":"HowToStep","text":"Roer de pesto erdoor."}]}]}
</script></head><body><nav>Home Recepten</nav><h1>Pasta pesto</h1><p>Een &eacute;cht snel recept.</p><script>alert(1)</script><footer>Reacties</footer></body></html>`

describe('leesReceptBlok', () => {
  it('vindt het Recipe-blok in een @graph en leest secties plat', () => {
    const blok = leesReceptBlok(PAGINA)
    expect(blok?.naam).toBe('Pasta pesto')
    expect(blok?.ingredienten).toEqual(['300 g penne', '1 potje pesto', '50 g pijnboompitten'])
    expect(blok?.stappen).toEqual(['Kook de pasta.', 'Roer de pesto erdoor.'])
    expect(blok?.minuten).toBe(25)
    expect(blok?.keuken).toBe('Italiaans')
    expect(blok?.auteur).toBe('Pauline')
    expect(receptBlokAlsTekst(blok!)).toContain('- 300 g penne')
  })
  it('geeft null zonder blok of zonder ingrediënten', () => {
    expect(leesReceptBlok('<html><body>niets</body></html>')).toBeNull()
    expect(leesReceptBlok('<script type="application/ld+json">{"@type":"Recipe","name":"leeg"}</script>')).toBeNull()
  })
  it('telt prep en cook op als er geen totaal is', () => {
    const blok = leesReceptBlok('<script type="application/ld+json">{"@type":"Recipe","prepTime":"PT10M","cookTime":"PT1H","recipeIngredient":["1 ui"],"recipeInstructions":"Bak."}</script>')
    expect(blok?.minuten).toBe(70)
    expect(blok?.stappen).toEqual(['Bak.'])
  })
})

describe('duurInMinuten', () => {
  it('leest ISO 8601', () => {
    expect(duurInMinuten('PT1H30M')).toBe(90)
    expect(duurInMinuten('PT45M')).toBe(45)
    expect(duurInMinuten('P0D')).toBeNull()
    expect(duurInMinuten(25)).toBeNull()
  })
})

describe('zichtbareTekst, siteNaamUit en canoniekeUrl', () => {
  it('laat navigatie, scripts en voettekst weg en vertaalt entiteiten', () => {
    const tekst = zichtbareTekst(PAGINA)
    expect(tekst).toContain('Pasta pesto')
    expect(tekst).toContain('Een écht snel recept.')
    expect(tekst).not.toContain('alert')
    expect(tekst).not.toContain('Home Recepten')
    expect(tekst).not.toContain('Reacties')
  })
  it('haalt sitenaam en canonieke link uit de kop', () => {
    expect(siteNaamUit(PAGINA, 'https://www.uitpaulineskeuken.nl/x')).toBe("Uit Pauline's Keuken")
    expect(siteNaamUit('<html></html>', 'https://www.ah.nl/allerhande')).toBe('ah.nl')
    expect(canoniekeUrl(PAGINA, 'https://www.uitpaulineskeuken.nl/recept/pasta-pesto/?utm=1')).toBe('https://www.uitpaulineskeuken.nl/recept/pasta-pesto/')
  })
})
