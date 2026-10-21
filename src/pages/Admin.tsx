import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Check, Mic, MicOff, Volume2 } from 'lucide-react'
import { saveTtsSettings } from '../lib/api'
import { createEngine } from '../lib/tts'
import { frenchVoices, TONES, voiceGender, voicesReady } from '../lib/tts/voices'
import { isRecognitionSupported } from '../lib/speech/listener'
import { useSettings } from '../context/SettingsContext'
import type { Character, Gender, TtsSettings } from '../lib/types'

const GENDER_LABEL: Record<Gender, string> = { male: 'masculine', female: 'féminine', neutral: 'indéterminée' }

function sampleCharacter(gender: Gender, tone: string): Character {
  return {
    id: 'test', play_id: 'test', name: 'Personnage test', description: null, personality: null,
    gender, tone, position: 0,
  }
}

export default function Admin() {
  const { tts, reload } = useSettings()
  const [draft, setDraft] = useState<TtsSettings>(tts)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [testText, setTestText] = useState('Hé quoi ! charmante Élise, vous devenez mélancolique ?')
  const [testGender, setTestGender] = useState<Gender>('female')
  const [testTone, setTestTone] = useState('neutre')
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])

  useEffect(() => setDraft(tts), [tts])
  useEffect(() => {
    voicesReady().then(() => setVoices(frenchVoices()))
  }, [])

  const save = async () => {
    setError(null)
    try {
      await saveTtsSettings(draft)
      await reload()
      setStatus('Réglages enregistrés pour tous les utilisateurs.')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const test = async () => {
    setError(null)
    try {
      await createEngine(draft).speak(testText, sampleCharacter(testGender, testTone), new AbortController().signal)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <main className="container">
      <Link to="/" className="back">
        <ArrowLeft size={16} aria-hidden /> Mes pièces
      </Link>
      <h1 className="section-title">Administration</h1>

      <section className="card">
        <h2>Synthèse vocale</h2>
        <fieldset className="radio-group">
          <label>
            <input
              type="radio"
              name="provider"
              checked={draft.provider === 'browser'}
              onChange={() => setDraft({ ...draft, provider: 'browser' })}
            />
            <span>
              <strong>Voix du navigateur</strong>
              <span className="muted small">Gratuit, sans clé. Qualité variable selon l’appareil.</span>
            </span>
          </label>
          <label>
            <input
              type="radio"
              name="provider"
              checked={draft.provider === 'openai'}
              onChange={() => setDraft({ ...draft, provider: 'openai' })}
            />
            <span>
              <strong>OpenAI TTS</strong>
              <span className="muted small">
                Voix naturelles qui suivent la personnalité du personnage. Nécessite la fonction <code>tts</code> et le
                secret <code>OPENAI_API_KEY</code> sur Supabase.
              </span>
            </span>
          </label>
        </fieldset>
        {draft.provider === 'openai' && (
          <label className="field">
            Modèle OpenAI
            <input value={draft.openaiModel} onChange={(e) => setDraft({ ...draft, openaiModel: e.target.value })} />
          </label>
        )}
        <label className="field">
          <span>
            Débit de parole : <strong>×{draft.speed.toFixed(2)}</strong>
          </span>
          <input
            type="range"
            min={0.75}
            max={2}
            step={0.05}
            value={draft.speed}
            onChange={(e) => setDraft({ ...draft, speed: Number(e.target.value) })}
          />
          <span className="muted small">S’applique à toutes les voix ; le ton de chaque personnage reste plus ou moins rapide.</span>
        </label>
        <button className="button primary" onClick={save}>
          <Check size={16} aria-hidden /> Enregistrer
        </button>
        {status && <p className="muted">{status}</p>}
        {error && <p className="error">{error}</p>}
      </section>

      <section className="card">
        <h2>Tester une voix</h2>
        <textarea rows={2} value={testText} onChange={(e) => setTestText(e.target.value)} aria-label="Texte de test" />
        <div className="row wrap">
          <select value={testGender} onChange={(e) => setTestGender(e.target.value as Gender)} aria-label="Type de voix">
            <option value="female">Voix féminine</option>
            <option value="male">Voix masculine</option>
            <option value="neutral">Voix neutre</option>
          </select>
          <select value={testTone} onChange={(e) => setTestTone(e.target.value)} aria-label="Ton">
            {Object.entries(TONES).map(([value, t]) => (
              <option key={value} value={value}>
                Ton : {t.label}
              </option>
            ))}
          </select>
          <button className="button" onClick={test}>
            <Volume2 size={16} aria-hidden /> Écouter ({draft.provider === 'openai' ? 'OpenAI' : 'navigateur'})
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Cet appareil</h2>
        <p>
          {isRecognitionSupported() ? (
            <><Mic size={16} aria-hidden /> Reconnaissance vocale disponible.</>
          ) : (
            <><MicOff size={16} aria-hidden /> Pas de reconnaissance vocale : il faudra avancer avec « Suivant ».</>
          )}
        </p>
        <p className="muted">{voices.length} voix françaises installées :</p>
        <ul className="voice-list">
          {voices.map((v) => (
            <li key={v.voiceURI}>
              {v.name} <span className="muted small">({v.lang}, voix {GENDER_LABEL[voiceGender(v)]})</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
