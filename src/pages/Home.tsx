import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Loader2, Play as PlayIcon, Trash2, UserCheck } from 'lucide-react'
import { deletePlay, importPlay, listPlays, type PlaySummary } from '../lib/api'
import { extractParagraphs } from '../lib/parser/html'
import { fetchGoogleDocHtml, googleDocId } from '../lib/parser/gdoc'
import { parsePlay } from '../lib/parser/parsePlay'
import { clearPlayData, getMyRole } from '../lib/storage'
import { plural } from '../lib/format'
import { useLoader } from '../hooks/useLoader'

const MAX_CHIPS = 8

function PlayTile({ play, onDelete }: { play: PlaySummary; onDelete: () => void }) {
  const navigate = useNavigate()
  const characters = [...play.characters].sort((a, b) => a.position - b.position)
  const myRoleId = getMyRole(play.id)
  const myRole = characters.find((c) => c.id === myRoleId)
  const acts = play.acts[0]?.count ?? 0
  const scenes = play.scenes[0]?.count ?? 0
  const draft = play.status === 'draft'

  return (
    <article className="card tile">
      <div className="tile-head">
        <div>
          <h2>{play.title}</h2>
          {play.author && <p className="muted">{play.author}</p>}
        </div>
        <button className="icon-button danger" onClick={onDelete} aria-label={`Supprimer ${play.title}`} title="Supprimer">
          <Trash2 size={18} />
        </button>
      </div>
      <p className="tile-stats">
        {plural(acts, 'acte')} · {plural(scenes, 'scène')} · {plural(characters.length, 'personnage')}
      </p>
      <ul className="chips">
        {characters.slice(0, MAX_CHIPS).map((c) => (
          <li key={c.id} className={c.id === myRoleId ? 'chip chip-mine' : 'chip'}>
            {c.name}
          </li>
        ))}
        {characters.length > MAX_CHIPS && <li className="chip">+{characters.length - MAX_CHIPS}</li>}
      </ul>
      <p className="tile-role">
        <UserCheck size={16} aria-hidden /> Mon rôle : <strong>{myRole?.name ?? 'non choisi'}</strong>
      </p>
      <button
        className="button primary"
        onClick={() => navigate(draft ? `/pieces/${play.id}/personnages` : `/pieces/${play.id}`)}
      >
        <PlayIcon size={18} aria-hidden /> {draft ? 'Confirmer les personnages' : 'Répéter cette pièce'}
      </button>
    </article>
  )
}

function ImportForm() {
  const navigate = useNavigate()
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const docId = googleDocId(url)
    if (!docId) {
      setError('Lien Google Docs invalide (attendu : https://docs.google.com/document/d/…).')
      return
    }
    try {
      setStatus('Téléchargement du document…')
      const html = await fetchGoogleDocHtml(docId)
      setStatus('Analyse du texte…')
      const { title, paragraphs } = extractParagraphs(html)
      const parsed = parsePlay(paragraphs, title)
      const lineCount = parsed.acts.reduce((n, a) => n + a.scenes.reduce((m, s) => m + s.lines.length, 0), 0)
      if (lineCount === 0) {
        throw new Error('Aucune réplique trouvée : les noms des personnages doivent être en MAJUSCULES en début de ligne.')
      }
      setStatus('Enregistrement…')
      const playId = await importPlay(parsed, url.trim())
      navigate(`/pieces/${playId}/personnages`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setStatus(null)
    }
  }

  return (
    <form className="card import" onSubmit={submit}>
      <h2>
        <FileText size={20} aria-hidden /> Importer une pièce
      </h2>
      <p className="muted">
        Collez le lien d’un Google Doc partagé à « Tous les utilisateurs disposant du lien ». Noms des personnages en
        MAJUSCULES, didascalies en italique.
      </p>
      <div className="row">
        <input
          type="url"
          required
          placeholder="https://docs.google.com/document/d/…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={status !== null}
          aria-label="Lien Google Docs"
        />
        <button className="button primary" disabled={status !== null}>
          {status ? <Loader2 size={18} className="spin" aria-hidden /> : null} Importer
        </button>
      </div>
      {status && <p className="muted">{status}</p>}
      {error && <p className="error">{error}</p>}
    </form>
  )
}

export default function Home() {
  const { data: plays, error, loading, reload } = useLoader(listPlays, [])

  const remove = async (play: PlaySummary) => {
    if (!confirm(`Supprimer « ${play.title} » pour tout le monde ? Cette action est définitive.`)) return
    await deletePlay(play.id)
    clearPlayData(play.id)
    reload()
  }

  return (
    <main className="container">
      <ImportForm />
      <h1 className="section-title">Mes pièces</h1>
      {loading && !plays && <p className="muted">Chargement…</p>}
      {error && <p className="error">{error}</p>}
      {plays?.length === 0 && <p className="muted">Aucune pièce pour l’instant : importez votre premier texte.</p>}
      <div className="grid">
        {plays?.map((play) => <PlayTile key={play.id} play={play} onDelete={() => remove(play)} />)}
      </div>
    </main>
  )
}
