import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Play as PlayIcon, Users } from 'lucide-react'
import { getPlay, getStructure } from '../lib/api'
import { getProgress } from '../lib/storage'
import { toRoman } from '../lib/format'
import { useLoader } from '../hooks/useLoader'

export default function Summary() {
  const { playId = '' } = useParams()
  const play = useLoader(() => getPlay(playId), [playId])
  const structure = useLoader(() => getStructure(playId), [playId])
  const [progress, setProgress] = useState(() => getProgress(playId))

  useEffect(() => {
    const refresh = () => setProgress(getProgress(playId))
    window.addEventListener('replique:storage', refresh)
    return () => window.removeEventListener('replique:storage', refresh)
  }, [playId])

  const error = play.error ?? structure.error
  if (error) return <main className="container"><p className="error">{error}</p></main>
  if (!play.data || !structure.data) return <main className="container"><p className="muted">Chargement…</p></main>

  const { acts, scenes } = structure.data

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
              .map((scene) => {
                const inProgress = progress[scene.id] !== undefined
                return (
                  <li key={scene.id} className={inProgress ? 'scene-row in-progress' : 'scene-row'}>
                    <Link to={`/pieces/${playId}/scenes/${scene.id}`} className="scene-link">
                      <span>
                        <strong>Scène {scene.number}</strong>
                        {scene.title && <span className="muted"> — {scene.title}</span>}
                      </span>
                      {inProgress && <span className="tag">En cours</span>}
                    </Link>
                    <Link
                      to={`/pieces/${playId}/scenes/${scene.id}`}
                      className="icon-button play"
                      aria-label={`Répéter la scène ${scene.number} de l’acte ${act.number}`}
                    >
                      <PlayIcon size={20} fill="currentColor" />
                    </Link>
                  </li>
                )
              })}
          </ul>
        </section>
      ))}
    </main>
  )
}
