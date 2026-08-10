import { useNavigate } from 'react-router-dom'
import { Inhoud, Kop, Label, OnderBalk, Scherm, Titel } from '../components/Layout'
import { Grens, Leeg } from '../components/Staten'
import { ReceptRegel } from '../components/ReceptRegel'
import { useFavorieten, useFavorietToggle } from '../lib/queries2'

export function Favorieten() {
  const navigeer = useNavigate()
  const favorieten = useFavorieten()
  const toggle = useFavorietToggle()
  const lijst = favorieten.data ?? []

  return (
    <Scherm>
      <Grens query={favorieten} ladenTekst="Favorieten ophalen">
        <Kop kleur="var(--c-ink)" style={{ paddingBottom: 22 }}>
          <Label>{lijst.length} bewaard</Label>
          <div style={{ marginTop: 12 }}><Titel grootte={26}>Favorieten</Titel></div>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.5, margin: '10px 0 0' }}>
            Deze komen vaker terug in je weekmenu.
          </p>
        </Kop>

        {lijst.length === 0 ? (
          <Leeg
            icoon="heart"
            kop="Nog geen favorieten"
            tekst="Tik op het hartje bij een recept om het hier te bewaren."
            knop="Recepten ontdekken"
            onKnop={() => navigeer('/ontdekken')}
          />
        ) : (
          <Inhoud style={{ gap: 10 }}>
            {lijst.map((r, i) => (
              <ReceptRegel
                key={r.id}
                recept={r}
                index={i}
                favoriet
                onOpen={() => navigeer(`/recept/${r.id}`)}
                onFavoriet={() => toggle.mutate({ receptId: r.id, favoriet: false })}
              />
            ))}
          </Inhoud>
        )}
      </Grens>

      <OnderBalk />
    </Scherm>
  )
}
