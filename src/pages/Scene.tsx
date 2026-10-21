import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Check, Lightbulb, Mic, MicOff, Pause, Pencil, Play as PlayIcon, Plus, RotateCcw, SkipForward, Trash2,
} from 'lucide-react'
import { deleteLine, getCharacters, getScene, getStructure, insertLine, updateLine } from '../lib/api'
import { getMyRole, getProgress, setSceneProgress } from '../lib/storage'
import { characterColor, toRoman } from '../lib/format'
import { isRecognitionSupported } from '../lib/speech/listener'
import { useSettings } from '../context/SettingsContext'
import { useLoader } from '../hooks/useLoader'
import { useRehearsal } from '../hooks/useRehearsal'
import type { Character, Line } from '../lib/types'
import { RoleSelect } from './Summary'

const HINT_STEP = 3

function hintText(text: string, words: number): string {
  const all = text.split(/\s+/)
  return all.length <= words ? text : `${all.slice(0, words).join(' ')}…`
}

interface PlayerProps {
  playId: string
  sceneId: string
  lines: Line[]
  characters: Map<string, Character>
  myRoleId: string | null
  nextSceneId: string | null
}

function Player({ playId, sceneId, lines, characters, myRoleId, nextSceneId }: PlayerProps) {
  const navigate = useNavigate()
  const { engine } = useSettings()
  const [initialIndex] = useState(() => getProgress(playId)[sceneId] ?? 0)
  const r = useRehearsal({ playId, sceneId, lines, characters, myRoleId, engine, initialIndex })
  const [hints, setHints] = useState<Record<string, number>>({})
  const refs = useRef<Record<string, HTMLLIElement | null>>({})
  const current = lines[r.index]
  const myTurn = current?.character_id === myRoleId
  const running = r.phase === 'speaking' || r.phase === 'listening'

  useEffect(() => {
    if (current) refs.current[current.id]?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [current])

  const showHint = () => {
    if (!current || !myTurn) return
    setHints((h) => ({ ...h, [current.id]: (h[current.id] ?? 0) + HINT_STEP }))
  }

  return (
    <>
      {r.error && <p className="error">{r.error}</p>}
      {myRoleId && !isRecognitionSupported() && (
        <p className="notice">
          <MicOff size={16} aria-hidden /> Ce navigateur ne reconnaît pas la voix : appuyez sur « Suivant » après votre
          réplique. (Chrome, Edge ou Safari la reconnaissent.)
        </p>
      )}
      {r.micIssue && <p className="notice"><MicOff size={16} aria-hidden /> {r.micIssue}</p>}

      <ol className="script">
        {lines.map((line, i) => {
          const character = characters.get(line.character_id)
          const mine = line.character_id === myRoleId
          const state = i === r.index ? 'current' : i < r.index ? 'past' : 'future'
          const hint = hints[line.id] ?? 0
          return (
            <li
              key={line.id}
              ref={(el) => {
                refs.current[line.id] = el
              }}
              className={`line ${state}${mine ? ' mine' : ''}`}
              onClick={() => r.goTo(i)}
            >
              <span className="speaker" style={{ color: characterColor(character?.position ?? 0) }}>
                {character?.name ?? '?'}
              </span>
              {mine ? (
                <p className="hidden-line">
                  {hint > 0 ? hintText(line.text, hint) : state === 'current' ? 'À vous !' : '• • •'}
                </p>
              ) : (
                <p>{line.text}</p>
              )}
              {mine && state === 'current' && r.phase === 'listening' && (
                <div className="listening" aria-live="polite">
                  <Mic size={16} aria-hidden className="pulse" />
                  <div className="meter"><span style={{ width: `${Math.round(r.ratio * 100)}%` }} /></div>
                  {r.transcript && <span className="muted small transcript">{r.transcript}</span>}
                </div>
              )}
            </li>
          )
        })}
      </ol>

      {r.phase === 'done' && (
        <div className="card done">
          <h2>Scène terminée !</h2>
          <div className="row wrap">
            <button className="button" onClick={r.restart}>
              <RotateCcw size={18} aria-hidden /> Recommencer
            </button>
            {nextSceneId && (
              <button className="button primary" onClick={() => navigate(`/pieces/${playId}/scenes/${nextSceneId}`)}>
                <SkipForward size={18} aria-hidden /> Scène suivante
              </button>
            )}
          </div>
        </div>
      )}

      <nav className="controls" aria-label="Contrôles de la répétition">
        <button className="icon-button" onClick={r.restart} aria-label="Recommencer" title="Recommencer">
          <RotateCcw size={22} />
        </button>
        {running ? (
          <button className="icon-button main" onClick={r.pause} aria-label="Pause" title="Pause">
            <Pause size={30} fill="currentColor" />
          </button>
        ) : (
          <button className="icon-button main" onClick={r.play} aria-label="Lecture" title="Lecture">
            <PlayIcon size={30} fill="currentColor" />
          </button>
        )}
        <button
          className="icon-button"
          onClick={showHint}
          disabled={!myTurn}
          aria-label="Indice"
          title="Indice : affiche le début de ma réplique"
        >
          <Lightbulb size={22} />
        </button>
        <button className="icon-button" onClick={r.next} disabled={r.index >= lines.length} aria-label="Suivant" title="Réplique suivante">
          <SkipForward size={22} />
        </button>
      </nav>
    </>
  )
}

function Editor({ playId, sceneId, lines, characters, onLinesChange }: {
  playId: string
  sceneId: string
  lines: Line[]
  characters: Character[]
  onLinesChange: (lines: Line[]) => void
}) {
  const [saved, setSaved] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const patch = (id: string, p: Partial<Line>) => onLinesChange(lines.map((l) => (l.id === id ? { ...l, ...p } : l)))

  const save = async (line: Line, p: Partial<Pick<Line, 'text' | 'character_id'>>) => {
    patch(line.id, p)
    try {
      await updateLine(line.id, p)
      setSaved(line.id)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const remove = async (line: Line) => {
    if (!confirm('Supprimer cette réplique ?')) return
    await deleteLine(line.id)
    onLinesChange(lines.filter((l) => l.id !== line.id))
  }

  /** Insère une réplique après l'index i (-1 : en tête de scène). */
  const addAfter = async (i: number) => {
    const before = lines[i]
    const after = lines[i + 1]
    const position = before && after ? (before.position + after.position) / 2 : before ? before.position + 10 : (after?.position ?? 20) - 10
    try {
      const created = await insertLine({
        play_id: playId,
        scene_id: sceneId,
        character_id: before?.character_id ?? characters[0].id,
        position,
        text: '…',
      })
      onLinesChange([...lines.slice(0, i + 1), created, ...lines.slice(i + 1)])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <>
      <p className="notice">
        <Pencil size={16} aria-hidden /> Mode édition : les modifications sont enregistrées pour tout le monde.
      </p>
      {error && <p className="error">{error}</p>}
      {characters.length > 0 && (
        <button className="button" onClick={() => addAfter(-1)}>
          <Plus size={16} aria-hidden /> Ajouter une réplique en tête de scène
        </button>
      )}
      <ol className="script editing">
        {lines.map((line, i) => (
          <li key={line.id} className="line">
            <div className="row">
              <select
                value={line.character_id}
                onChange={(e) => save(line, { character_id: e.target.value })}
                aria-label="Personnage"
              >
                {characters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {saved === line.id && <Check size={16} className="saved" aria-label="Enregistré" />}
              <span className="spacer" />
              <button className="icon-button" onClick={() => addAfter(i)} aria-label="Ajouter une réplique après" title="Ajouter après">
                <Plus size={18} />
              </button>
              <button className="icon-button danger" onClick={() => remove(line)} aria-label="Supprimer la réplique" title="Supprimer">
                <Trash2 size={18} />
              </button>
            </div>
            <textarea
              value={line.text}
              rows={Math.min(12, Math.max(2, Math.ceil(line.text.length / 60) + line.text.split('\n').length - 1))}
              onChange={(e) => patch(line.id, { text: e.target.value })}
              onBlur={(e) => save(line, { text: e.target.value.trim() })}
              aria-label={`Réplique ${i + 1}`}
            />
          </li>
        ))}
      </ol>
    </>
  )
}

export default function ScenePage() {
  const { playId = '', sceneId = '' } = useParams()
  const scene = useLoader(() => getScene(sceneId), [sceneId])
  const characters = useLoader(() => getCharacters(playId), [playId])
  const structure = useLoader(() => getStructure(playId), [playId])
  const [myRole, setMyRoleState] = useState(() => getMyRole(playId))
  const [editing, setEditing] = useState(false)

  const byId = useMemo(() => new Map((characters.data ?? []).map((c) => [c.id, c as Character])), [characters.data])
  const nextSceneId = useMemo(() => {
    const scenes = structure.data?.scenes ?? []
    const i = scenes.findIndex((s) => s.id === sceneId)
    return i >= 0 ? scenes[i + 1]?.id ?? null : null
  }, [structure.data, sceneId])

  const error = scene.error ?? characters.error
  if (error) return <main className="container"><p className="error">{error}</p></main>
  if (!scene.data || !characters.data) return <main className="container"><p className="muted">Chargement…</p></main>

  const { act, lines } = scene.data
  const setLines = (next: Line[]) => scene.setData({ ...scene.data!, lines: next })

  return (
    <main className="container scene-page">
      <Link to={`/pieces/${playId}`} className="back">
        <ArrowLeft size={16} aria-hidden /> Sommaire
      </Link>
      <section className="card scene-head">
        <div>
          <p className="eyebrow">Acte {toRoman(act.number)}</p>
          <h1>
            Scène {scene.data.scene.number}
            {scene.data.scene.title && <span className="muted"> — {scene.data.scene.title}</span>}
          </h1>
        </div>
        <div className="row wrap">
          {!editing && (
            <RoleSelect playId={playId} characters={characters.data} value={myRole} onChange={setMyRoleState} />
          )}
          <button
            className={editing ? 'button primary' : 'button'}
            onClick={() => {
              // La position de lecture n'a plus de sens si le texte change
              if (!editing) setSceneProgress(playId, sceneId, null)
              setEditing(!editing)
            }}
          >
            {editing ? <><Check size={16} aria-hidden /> Terminer</> : <><Pencil size={16} aria-hidden /> Éditer</>}
          </button>
        </div>
      </section>

      {lines.length === 0 && <p className="muted">Cette scène ne contient aucune réplique.</p>}

      {editing ? (
        <Editor playId={playId} sceneId={sceneId} lines={lines} characters={characters.data} onLinesChange={setLines} />
      ) : (
        <Player
          key={`${sceneId}-${myRole}`}
          playId={playId}
          sceneId={sceneId}
          lines={lines}
          characters={byId}
          myRoleId={myRole}
          nextSceneId={nextSceneId}
        />
      )}
    </main>
  )
}
