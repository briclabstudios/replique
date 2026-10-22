import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Play as PlayIcon, Users } from 'lucide-react'
import { getCharacters, getPlay, getSceneCasts, getStructure } from '../lib/api'
import { toRoman } from '../lib/format'
import { getMyRole } from '../lib/storage'
import { useLoader } from '../hooks/useLoader'

export default function Summary() {
  const { playId = '' } = useParams()
  const play = useLoader(() => getPlay(playId), [playId])
  const structure = useLoader(() => getStructure(playId), [playId])
  const characters = useLoader(() => getCharacters(playId), [playId])
  const casts = useLoader(() => getSceneCasts(playId), [playId])

  const error = play.error ?? structure.error
  if (error) return <main className="container"><p className="error">{error}</p></main>
  if (!play.data || !structure.data) return <main className="container"><p className="muted">Chargement…</p></main>

  const { acts, scenes } = structure.data
  const names = new Map(characters.data?.map((c) => [c.id, c.name]))
  const myRoleId = getMyRole(playId)

  return (
    <main className="container">
      <Link to="/" className="back">
        <ArrowLeft size={16} aria-hidden /> Mes pièces
      </Link>
      <section className="card summary-head">
        <div>
          <h1>{play.data.title}</h1>
          {play.data.author && <p className="muted">{play.data.author}</p>}
        </div>
        <Link to={`/pieces/${playId}/personnages`} className="button">
          <Users size={16} aria-hidden /> Personnages
        </Link>
      </section>

      {acts.map((act) => (
        <section key={act.id} className="act">
          <h2>
            Acte {toRoman(act.number)}
            {act.title && <span className="muted"> — {act.title}</span>}
          </h2>
          <ul className="scene-list">
            {scenes
              .filter((s) => s.act_id === act.id)
              .map((scene) => (
                <li key={scene.id} className="scene-row">
                  <Link to={`/pieces/${playId}/scenes/${scene.id}`} className="scene-link">
                    <div>
                      <strong>Scène {scene.number}</strong>
                      {scene.title && <span className="muted"> — {scene.title}</span>}
                      {casts.data?.get(scene.id)?.length ? (
                        <ul className="chips" aria-label="Personnages de la scène">
                          {casts.data.get(scene.id)!.map((id) => (
                            <li key={id} className={id === myRoleId ? 'chip chip-mine' : 'chip'}>
                              {names.get(id) ?? '?'}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </Link>
                  <Link
                    to={`/pieces/${playId}/scenes/${scene.id}`}
                    className="icon-button play"
                    aria-label={`Répéter la scène ${scene.number} de l’acte ${act.number}`}
                  >
                    <PlayIcon size={20} fill="currentColor" />
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </main>
  )
}
