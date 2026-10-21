import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Check, Copy, Star, Trash2, Volume2 } from 'lucide-react'
import {
  deleteCharacter,
  getCharacters,
  getPlay,
  mergeCharacter,
  updateCharacter,
  updatePlay,
  type CharacterWithCount,
} from '../lib/api'
import { getCharacterVoice, getMyRole, setCharacterVoice, setMyRole } from '../lib/storage'
import { characterColor, plural } from '../lib/format'
import { frenchVoices, TONES, voicesReady } from '../lib/tts/voices'
import { useSettings } from '../context/SettingsContext'
import { useLoader } from '../hooks/useLoader'
import type { Character, Gender } from '../lib/types'

const GENDERS: { value: Gender; label: string }[] = [
  { value: 'female', label: 'Voix féminine' },
  { value: 'male', label: 'Voix masculine' },
  { value: 'neutral', label: 'Voix neutre' },
]

interface CardProps {
  character: CharacterWithCount
  others: CharacterWithCount[]
  /** Voix françaises installées sur cet appareil. */
  voices: SpeechSynthesisVoice[]
  isMine: boolean
  onToggleMine: () => void
  onChange: (patch: Partial<Character>) => void
  onSave: (patch: Partial<Character>) => Promise<void>
  onMerge: (targetId: string) => void
  onDelete: () => void
}

function CharacterCard({ character, others, voices, isMine, onToggleMine, onChange, onSave, onMerge, onDelete }: CardProps) {
  const { engine, tts } = useSettings()
  const [listening, setListening] = useState(false)
  const [voiceURI, setVoiceURI] = useState(() => getCharacterVoice(character.id))
  const savedVoiceMissing = voiceURI !== null && !voices.some((v) => v.voiceURI === voiceURI)

  const chooseVoice = (uri: string) => {
    setCharacterVoice(character.id, uri || null)
    setVoiceURI(uri || null)
  }
  const lineCount = character.lines[0]?.count ?? 0

  const preview = async () => {
    setListening(true)
    const sample = character.personality
      ? `Je suis ${character.name}. ${character.personality}`
      : `Bonjour, je suis ${character.name}. Voici ma voix pour la répétition.`
    try {
      await engine.speak(sample, character, new AbortController().signal)
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    } finally {
      setListening(false)
    }
  }

  return (
    <li className={isMine ? 'card character mine' : 'card character'} style={{ borderLeftColor: characterColor(character.position) }}>
      <div className="character-head">
        <input
          className="character-name"
          value={character.name}
          onChange={(e) => onChange({ name: e.target.value })}
          onBlur={(e) => onSave({ name: e.target.value.trim() || character.name })}
          aria-label="Nom du personnage"
        />
        <span className="muted">{plural(lineCount, 'réplique')}</span>
      </div>
      {character.description && <p className="muted small">{character.description}</p>}

      <div className="row wrap">
        <select
          value={character.gender}
          onChange={(e) => onSave({ gender: e.target.value as Gender })}
          aria-label="Type de voix"
        >
          {GENDERS.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </select>
        <select value={character.tone} onChange={(e) => onSave({ tone: e.target.value })} aria-label="Ton">
          {Object.entries(TONES).map(([value, t]) => (
            <option key={value} value={value}>
              Ton : {t.label}
            </option>
          ))}
        </select>
        {tts.provider === 'browser' && (
          <select
            value={savedVoiceMissing ? '' : voiceURI ?? ''}
            onChange={(e) => chooseVoice(e.target.value)}
            aria-label="Voix du navigateur"
            disabled={voices.length === 0}
          >
            <option value="">{voices.length === 0 ? 'Aucune voix française' : 'Voix : automatique'}</option>
            {voices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                Voix : {v.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <textarea
        rows={2}
        placeholder="Personnalité (ex. avare, soupçonneux, toujours pressé…) pour adapter la voix et le ton"
        value={character.personality ?? ''}
        onChange={(e) => onChange({ personality: e.target.value })}
        onBlur={(e) => onSave({ personality: e.target.value.trim() || null })}
        aria-label="Personnalité"
      />

      <div className="row wrap actions">
        <button type="button" className={isMine ? 'button primary' : 'button'} onClick={onToggleMine} aria-pressed={isMine}>
          <Star size={16} aria-hidden fill={isMine ? 'currentColor' : 'none'} /> {isMine ? 'Mon rôle' : 'C’est mon rôle'}
        </button>
        <button type="button" className="button" onClick={preview} disabled={listening}>
          <Volume2 size={16} aria-hidden /> Écouter
        </button>
        <label className="button merge">
          <Copy size={16} aria-hidden />
          <select
            value=""
            onChange={(e) => e.target.value && onMerge(e.target.value)}
            aria-label={`Marquer ${character.name} comme doublon de…`}
          >
            <option value="">Doublon de…</option>
            {others.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="button danger" onClick={onDelete}>
          <Trash2 size={16} aria-hidden /> Supprimer
        </button>
      </div>
    </li>
  )
}

export default function Characters() {
  const { playId = '' } = useParams()
  const navigate = useNavigate()
  const play = useLoader(() => getPlay(playId), [playId])
  const characters = useLoader(() => getCharacters(playId), [playId])
  const [myRole, setMyRoleState] = useState(() => getMyRole(playId))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])

  useEffect(() => {
    voicesReady().then(() => setVoices(frenchVoices()))
  }, [])

  const list = characters.data ?? []

  const patchLocal = (id: string, patch: Partial<Character>) =>
    characters.setData((cs) => cs?.map((c) => (c.id === id ? { ...c, ...patch } : c)) ?? cs)

  const save = async (id: string, patch: Partial<Character>) => {
    patchLocal(id, patch)
    try {
      await updateCharacter(id, patch)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const toggleMine = (id: string) => {
    const next = myRole === id ? null : id
    setMyRole(playId, next)
    setMyRoleState(next)
  }

  const merge = async (source: CharacterWithCount, targetId: string) => {
    const target = list.find((c) => c.id === targetId)
    if (!target) return
    if (!confirm(`Fusionner « ${source.name} » dans « ${target.name} » ? Ses répliques seront attribuées à ${target.name}.`)) return
    await mergeCharacter(source.id, targetId)
    if (myRole === source.id) toggleMine(targetId)
    characters.reload()
  }

  const remove = async (c: CharacterWithCount) => {
    const count = c.lines[0]?.count ?? 0
    const warning = count > 0 ? ` Ses ${plural(count, 'réplique')} seront aussi supprimées.` : ''
    if (!confirm(`Supprimer « ${c.name} » ?${warning}`)) return
    await deleteCharacter(c.id)
    if (myRole === c.id) toggleMine(c.id)
    characters.reload()
  }

  const confirmAll = async () => {
    setSaving(true)
    try {
      await updatePlay(playId, { status: 'ready' })
      navigate(`/pieces/${playId}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setSaving(false)
    }
  }

  const savePlay = async (patch: { title?: string; author?: string | null }) => {
    play.setData((p) => (p ? { ...p, ...patch } : p))
    await updatePlay(playId, patch).catch((e) => setError(e.message))
  }

  if (play.error || characters.error) return <main className="container"><p className="error">{play.error ?? characters.error}</p></main>
  if (!play.data || !characters.data) return <main className="container"><p className="muted">Chargement…</p></main>

  return (
    <main className="container">
      <section className="card">
        <p className="eyebrow">Étape 1 · Personnages</p>
        <div className="row wrap">
          <input
            className="title-input"
            value={play.data.title}
            onChange={(e) => play.setData({ ...play.data!, title: e.target.value })}
            onBlur={(e) => savePlay({ title: e.target.value.trim() || 'Pièce sans titre' })}
            aria-label="Titre de la pièce"
          />
          <input
            value={play.data.author ?? ''}
            placeholder="Auteur"
            onChange={(e) => play.setData({ ...play.data!, author: e.target.value })}
            onBlur={(e) => savePlay({ author: e.target.value.trim() || null })}
            aria-label="Auteur"
          />
        </div>
        <p className="muted">
          Vérifiez les personnages détectés : corrigez les noms, décrivez leur personnalité pour adapter la voix, et
          indiquez votre rôle — ses répliques ne seront pas lues pendant les répétitions.
        </p>
      </section>

      {error && <p className="error">{error}</p>}

      <ul className="character-list">
        {list.map((c) => (
          <CharacterCard
            key={c.id}
            character={c}
            others={list.filter((o) => o.id !== c.id)}
            voices={voices}
            isMine={myRole === c.id}
            onToggleMine={() => toggleMine(c.id)}
            onChange={(patch) => patchLocal(c.id, patch)}
            onSave={(patch) => save(c.id, patch)}
            onMerge={(targetId) => merge(c, targetId)}
            onDelete={() => remove(c)}
          />
        ))}
      </ul>

      {/* Toujours visible en bas de l'écran, sans devoir faire défiler toute la liste */}
      <div className="footer-actions">
        {!myRole && <p className="muted small">Astuce : choisissez votre rôle avant de répéter.</p>}
        <button className="button primary large" onClick={confirmAll} disabled={saving}>
          <Check size={20} aria-hidden /> Valider les modifications
        </button>
      </div>
    </main>
  )
}
