// Écoute de mes répliques avec la reconnaissance vocale du navigateur (Chrome, Edge, Safari).
// Le micro reste ouvert pendant toute la lecture de la scène : démarrer la reconnaissance prend
// jusqu'à une seconde, et les premiers mots d'une réplique seraient perdus. Seul ce qui est
// entendu pendant mon tour compte.

import { coverage, echoDetector, endReached, mergeRepeats } from './match'

/* Types minimaux : l'API n'est pas dans les définitions DOM standard */
interface RecognitionResult {
  isFinal: boolean
  0: { transcript: string }
}
interface RecognitionEvent {
  resultIndex: number
  results: ArrayLike<RecognitionResult>
}
interface Recognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  onaudiostart: (() => void) | null
  onresult: ((e: RecognitionEvent) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  abort(): void
}
type RecognitionCtor = new () => Recognition

function recognitionCtor(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export const isRecognitionSupported = () => recognitionCtor() !== null

/** off : arrêté · starting : en cours d'activation · ready : on peut parler · unavailable : avancer à la main */
export type MicState = 'off' | 'starting' | 'ready' | 'unavailable'

interface Turn {
  expected: string
  /** Écho de la réplique lue juste avant par la synthèse vocale : ignoré. */
  isEcho: (heard: string) => boolean
  onProgress?: (transcript: string, ratio: number) => void
  done: () => void
  silenceTimer?: ReturnType<typeof setTimeout>
}

const SILENCE_MS = 2200
const COVERAGE_DONE = 0.8
const COVERAGE_WITH_END = 0.5
const COVERAGE_ON_SILENCE = 0.4
// Relances trop rapprochées : le service de reconnaissance ne répond pas, on abandonne
const MAX_QUICK_RESTARTS = 5
const QUICK_RESTART_MS = 1000

export class SceneListener {
  private recognition: Recognition | null = null
  private active = false
  /**
   * Résultats reconnus pendant le tour en cours, rangés par « session:position » dans l'ordre
   * d'arrivée. Chrome sur Android renvoie plusieurs fois un même résultat : rangé à sa position,
   * il remplace le précédent au lieu de s'ajouter.
   */
  private segments = new Map<string, { text: string; final: boolean }>()
  /** Résultats définitifs avant le début de mon tour : ils ne comptent plus, même renvoyés. */
  private ignored = new Set<string>()
  private session = 0
  private turn: Turn | null = null
  private quickRestarts = 0
  private lastStart = 0
  private onStateChange: (state: MicState) => void
  private onUnavailable: (reason: string) => void

  constructor(onStateChange: (state: MicState) => void, onUnavailable: (reason: string) => void) {
    this.onStateChange = onStateChange
    this.onUnavailable = onUnavailable
  }

  /** Ouvre le micro pour la scène ; sans effet s'il est déjà ouvert. */
  start() {
    if (this.active) return
    if (!recognitionCtor()) {
      this.fail('La reconnaissance vocale n’est pas disponible sur ce navigateur.')
      return
    }
    this.active = true
    this.quickRestarts = 0
    this.launch()
  }

  stop() {
    this.active = false
    this.endTurn()
    try {
      this.recognition?.abort()
    } catch {
      // déjà arrêtée
    }
    this.recognition = null
    // Les sessions suivantes ont de nouveaux numéros : rien de l'ancienne ne peut revenir
    this.segments.clear()
    this.ignored.clear()
    this.onStateChange('off')
  }

  /**
   * Attend que la réplique soit dite. Se résout quand assez de mots ont été reconnus,
   * quand la fin est dite, après un silence si l'essentiel a été dit, ou à l'annulation.
   * Si le micro est indisponible, seule l'annulation (bouton « Suivant ») la résout.
   */
  waitForLine(
    expected: string,
    previous: string | null,
    signal: AbortSignal,
    onProgress?: Turn['onProgress'],
  ): Promise<void> {
    this.endTurn()
    return new Promise<void>((resolve) => {
      if (signal.aborted) return resolve()
      const done = () => {
        signal.removeEventListener('abort', done)
        if (this.turn === turn) this.endTurn()
        resolve()
      }
      // Les résultats définitifs sont écartés ; celui en cours peut déjà contenir mes premiers mots
      for (const [key, segment] of this.segments) {
        if (segment.final) {
          this.ignored.add(key)
          this.segments.delete(key)
        }
      }
      const turn: Turn = {
        expected,
        isEcho: previous ? echoDetector(previous) : () => false,
        onProgress,
        done,
      }
      this.turn = turn
      signal.addEventListener('abort', done)
    })
  }

  private endTurn() {
    if (this.turn) clearTimeout(this.turn.silenceTimer)
    this.turn = null
  }

  private fail(reason: string) {
    this.active = false
    this.recognition = null
    this.onStateChange('unavailable')
    this.onUnavailable(reason)
  }

  private launch() {
    const Ctor = recognitionCtor()
    if (!this.active || !Ctor) return
    const now = Date.now()
    this.quickRestarts = now - this.lastStart < QUICK_RESTART_MS ? this.quickRestarts + 1 : 0
    this.lastStart = now
    if (this.quickRestarts > MAX_QUICK_RESTARTS) {
      this.fail('La reconnaissance vocale ne répond pas : avancez avec le bouton « Suivant ».')
      return
    }

    const recognition = new Ctor()
    this.recognition = recognition
    const session = ++this.session
    recognition.lang = 'fr-FR'
    recognition.continuous = true
    recognition.interimResults = true
    this.onStateChange('starting')

    recognition.onaudiostart = () => {
      if (this.recognition === recognition) this.onStateChange('ready')
    }
    recognition.onresult = (e) => {
      if (this.recognition !== recognition) return
      // Toute la liste est relue : sur Android, resultIndex n'est pas fiable
      for (let i = 0; i < e.results.length; i++) {
        const key = `${session}:${i}`
        if (this.ignored.has(key)) continue
        const r = e.results[i]
        this.segments.set(key, { text: r[0].transcript, final: r.isFinal })
      }
      this.check()
    }
    recognition.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture') {
        this.fail('Micro inaccessible : autorisez-le, ou avancez avec le bouton « Suivant ».')
      }
    }
    // Les navigateurs arrêtent l'écoute après un long silence : on relance
    recognition.onend = () => {
      if (this.recognition !== recognition) return
      // Les résultats provisoires d'une session terminée ne deviendront jamais définitifs
      for (const [key, segment] of this.segments) {
        if (!segment.final && key.startsWith(`${session}:`)) this.segments.delete(key)
      }
      if (this.active) setTimeout(() => this.launch(), 150)
    }

    try {
      recognition.start()
    } catch {
      this.fail('Impossible de démarrer le micro.')
    }
  }

  /** Ce que j'ai dit pendant mon tour, sans écho de la réplique précédente ni répétition. */
  private heardThisTurn(turn: Turn): string {
    const texts = [...this.segments.values()].map((s) => s.text).filter((text) => !turn.isEcho(text))
    return mergeRepeats(texts).join(' ').trim()
  }

  private check() {
    const turn = this.turn
    if (!turn) return
    const heard = this.heardThisTurn(turn)
    const ratio = coverage(turn.expected, heard)
    turn.onProgress?.(heard, ratio)
    if (ratio >= COVERAGE_DONE || (ratio >= COVERAGE_WITH_END && endReached(turn.expected, heard))) {
      turn.done()
      return
    }
    clearTimeout(turn.silenceTimer)
    turn.silenceTimer = setTimeout(() => {
      if (this.turn === turn && coverage(turn.expected, this.heardThisTurn(turn)) >= COVERAGE_ON_SILENCE) turn.done()
    }, SILENCE_MS)
  }
}
