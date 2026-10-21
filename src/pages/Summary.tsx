import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Play as PlayIcon, Users } from 'lucide-react'
import { getCharacters, getPlay, getStructure } from '../lib/api'
import { getMyRole, getProgress, setMyRole } from '../lib/storage'
import { toRoman } from '../lib/format'
import { useLoader } from '../hooks/useLoader'

export function RoleSelect({ playId, characters, value, onChange }: {
  playId: string
  characters: { id: string; name: string }[]
  value: string | null
  onChange: (id: string | null) => void
}) {
  return (
    <label className="role-select">
      Mon rôle
      <select
        value={value ?? ''}
        onChange={(e) => {
          const id = e.target.value || null
          setMyRole(playId, id)
          onChange(id)
        }}
      >
        <option value="">— Aucun (tout est lu) —</option>
        {characters.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  )
}

export default function Summary() {
  const { playId = '' } = useParams()
  const play = useLoader(() => getPlay(playId), [playId])
  const structure = useLoader(() => getStructure(playId), [playId])
  const characters = useLoader(() => getCharacters(playId), [playId])
  const [myRole, setMyRoleState] = useState(() => getMyRole(playId))
  const [progress, setProgress] = useState(() => getProgress(playId))

  useEffect(() => {
    const refresh = () => setProgress(getProgress(playId))
    window.addEventListener('replique:storage', refresh)
    return () => window.removeEventListener('replique:storage', refresh)
  }, [playId])

  const error = play.error ?? structure.error ?? characters.error
  if (error) return <main className="container"><p className="error">{error}</p></main>
  if (!play.data || !structure.data || !characters.data) return <main className="container"><p className="muted">Chargement…</p></main>

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
        <div className="row wrap">
          <RoleSelect playId={playId} characters={characters.data} value={myRole} onChange={setMyRoleState} />
          <Link to={`/pieces/${playId}/personnages`} className="button">
            <Users size={16} aria-hidden /> Personnages
          </Link>
        </div>
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
