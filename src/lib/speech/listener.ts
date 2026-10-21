// Écoute de ma réplique avec la reconnaissance vocale du navigateur (Chrome, Edge, Safari).

import { coverage, endReached } from './match'

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
  onresult: ((e: RecognitionEvent) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
type RecognitionCtor = new () => Recognition

function recognitionCtor(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export const isRecognitionSupported = () => recognitionCtor() !== null

export interface ListenOptions {
  signal: AbortSignal
  /** Appelé à chaque résultat, avec la transcription et la part de la réplique reconnue. */
  onProgress?: (transcript: string, ratio: number) => void
  /** Appelé si le micro est refusé ou indisponible : il faudra avancer manuellement. */
  onUnavailable?: (reason: string) => void
}

const SILENCE_MS = 2200
const COVERAGE_DONE = 0.8
const COVERAGE_WITH_END = 0.5
const COVERAGE_ON_SILENCE = 0.4

/**
 * Attend que la réplique soit dite. Se résout quand assez de mots ont été reconnus,
 * quand la fin est dite, après un silence si l'essentiel a été dit, ou à l'annulation.
 */
export function listenForLine(expected: string, { signal, onProgress, onUnavailable }: ListenOptions): Promise<void> {
  const Ctor = recognitionCtor()
  return new Promise<void>((resolve) => {
    if (signal.aborted) return resolve()
    let recognition: Recognition | null = null
    let finished = false
    let finalText = ''
    let silenceTimer: ReturnType<typeof setTimeout> | undefined

    const finish = () => {
      if (finished) return
      finished = true
      clearTimeout(silenceTimer)
      signal.removeEventListener('abort', finish)
      try {
        recognition?.abort()
      } catch {
        // déjà arrêtée
      }
      resolve()
    }
    signal.addEventListener('abort', finish)

    if (!Ctor) {
      onUnavailable?.('La reconnaissance vocale n’est pas disponible sur ce navigateur.')
      return
    }

    const start = () => {
      if (finished) return
      recognition = new Ctor()
      recognition.lang = 'fr-FR'
      recognition.continuous = true
      recognition.interimResults = true
      recognition.onresult = (e) => {
        let interim = ''
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i]
          if (r.isFinal) finalText += ` ${r[0].transcript}`
          else interim += ` ${r[0].transcript}`
        }
        const heard = `${finalText} ${interim}`.trim()
        const ratio = coverage(expected, heard)
        onProgress?.(heard, ratio)
        if (ratio >= COVERAGE_DONE || (ratio >= COVERAGE_WITH_END && endReached(expected, heard))) {
          finish()
          return
        }
        clearTimeout(silenceTimer)
        silenceTimer = setTimeout(() => {
          if (coverage(expected, `${finalText} ${interim}`) >= COVERAGE_ON_SILENCE) finish()
        }, SILENCE_MS)
      }
      recognition.onerror = (e) => {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture') {
          onUnavailable?.('Micro inaccessible : autorisez-le, ou avancez avec le bouton « Suivant ».')
          recognition = null
        }
      }
      // Les navigateurs mobiles arrêtent l'écoute après un silence : on relance
      recognition.onend = () => {
        if (!finished && recognition) setTimeout(start, 150)
      }
      try {
        recognition.start()
      } catch {
        onUnavailable?.('Impossible de démarrer le micro.')
      }
    }
    start()
  })
}
