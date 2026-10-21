// Moteurs de synthèse vocale : voix du navigateur (gratuit) ou OpenAI via la fonction edge `tts`.

import { functionHeaders, functionUrl } from '../supabase'
import type { Character, TtsSettings } from '../types'
import { browserVoice, openAiInstructions, openAiVoice, voicesReady } from './voices'

export interface TtsEngine {
  /** Lit le texte ; la promesse se résout à la fin de la lecture ou à l'annulation. */
  speak(text: string, character: Character, signal: AbortSignal): Promise<void>
  /** Prépare la réplique suivante pour limiter l'attente. */
  prefetch?(text: string, character: Character): void
}

/** Chrome coupe les longues lectures : on lit phrase par phrase. */
function sentences(text: string): string[] {
  const parts = text.replace(/\n+/g, ' ').match(/[^.!?…]+[.!?…]+[»"”)]*\s*|[^.!?…]+$/g) ?? [text]
  const chunks: string[] = []
  for (const part of parts) {
    const last = chunks[chunks.length - 1]
    // Regroupe les fragments très courts (« Ah ! Oh ! ») pour garder une intonation naturelle
    if (last !== undefined && last.length < 40) chunks[chunks.length - 1] = last + part
    else chunks.push(part)
  }
  return chunks.map((c) => c.trim()).filter(Boolean)
}

export const createBrowserEngine = (settings: TtsSettings): TtsEngine => ({
  async speak(text, character, signal) {
    if (!('speechSynthesis' in window)) return
    await voicesReady()
    const { voice, rate, pitch } = browserVoice(character)
    for (const chunk of sentences(text)) {
      if (signal.aborted) return
      await new Promise<void>((resolve) => {
        const u = new SpeechSynthesisUtterance(chunk)
        u.lang = voice?.lang ?? 'fr-FR'
        if (voice) u.voice = voice
        u.rate = Math.min(10, Math.max(0.1, rate * settings.speed))
        u.pitch = pitch
        const finish = () => {
          signal.removeEventListener('abort', onAbort)
          resolve()
        }
        const onAbort = () => {
          speechSynthesis.cancel()
          finish()
        }
        u.onend = finish
        u.onerror = finish
        signal.addEventListener('abort', onAbort)
        speechSynthesis.speak(u)
      })
    }
  },
})

export function createOpenAiEngine(settings: TtsSettings): TtsEngine {
  const cache = new Map<string, Promise<string>>()

  const audioUrl = (text: string, character: Character) => {
    const voice = openAiVoice(character)
    const instructions = openAiInstructions(character)
    const key = `${voice}|${instructions}|${text}`
    let url = cache.get(key)
    if (!url) {
      url = fetch(functionUrl('tts'), {
        method: 'POST',
        headers: { ...functionHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice, instructions, model: settings.openaiModel }),
      }).then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error ?? `Synthèse OpenAI indisponible (${res.status})`)
        }
        return URL.createObjectURL(await res.blob())
      })
      url.catch(() => cache.delete(key))
      cache.set(key, url)
    }
    return url
  }

  return {
    prefetch(text, character) {
      audioUrl(text, character).catch(() => {})
    },
    async speak(text, character, signal) {
      const src = await audioUrl(text, character)
      if (signal.aborted) return
      const audio = new Audio(src)
      // gpt-4o-mini-tts ignore le paramètre `speed` : on accélère la lecture, hauteur de voix conservée
      audio.preservesPitch = true
      audio.defaultPlaybackRate = settings.speed
      audio.playbackRate = settings.speed
      await new Promise<void>((resolve, reject) => {
        const finish = () => {
          signal.removeEventListener('abort', onAbort)
          resolve()
        }
        const onAbort = () => {
          audio.pause()
          finish()
        }
        audio.onended = finish
        audio.onerror = () => reject(new Error('Lecture audio impossible'))
        signal.addEventListener('abort', onAbort)
        audio.play().catch(reject)
      })
    },
  }
}

export function createEngine(settings: TtsSettings): TtsEngine {
  return settings.provider === 'openai' ? createOpenAiEngine(settings) : createBrowserEngine(settings)
}
