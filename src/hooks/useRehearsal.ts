import { useCallback, useEffect, useRef, useState } from 'react'
import { SceneListener, type MicState } from '../lib/speech/listener'
import { setSceneProgress } from '../lib/storage'
import type { TtsEngine } from '../lib/tts'
import type { Character, Line } from '../lib/types'

export type Phase = 'idle' | 'speaking' | 'listening' | 'paused' | 'done'

interface Options {
  playId: string
  sceneId: string
  lines: Line[]
  characters: Map<string, Character>
  myRoleId: string | null
  engine: TtsEngine
  initialIndex: number
}

/**
 * Déroulé d'une scène : les voix IA lisent les répliques des autres personnages,
 * puis l'app écoute la mienne avant de continuer.
 */
export function useRehearsal({ playId, sceneId, lines, characters, myRoleId, engine, initialIndex }: Options) {
  const [index, setIndexState] = useState(Math.min(initialIndex, lines.length))
  const [phase, setPhase] = useState<Phase>(initialIndex > 0 ? 'paused' : 'idle')
  const [transcript, setTranscript] = useState('')
  const [ratio, setRatio] = useState(0)
  const [micIssue, setMicIssue] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [micState, setMicState] = useState<MicState>('off')
  const controller = useRef<AbortController | null>(null)
  const indexRef = useRef(index)
  const listener = useRef<SceneListener | null>(null)
  // La boucle de lecture dure toute la scène : elle relit le moteur à chaque réplique (réglage de débit modifié en cours de route)
  const engineRef = useRef(engine)
  engineRef.current = engine
  if (!listener.current) listener.current = new SceneListener(setMicState, setMicIssue)

  const setIndex = useCallback(
    (i: number) => {
      indexRef.current = i
      setIndexState(i)
      setSceneProgress(playId, sceneId, i >= lines.length ? null : i)
    },
    [playId, sceneId, lines.length],
  )

  /** Interrompt la lecture en cours, micro compris. */
  const stop = useCallback(() => {
    controller.current?.abort()
    controller.current = null
    listener.current?.stop()
  }, [])

  const run = useCallback(
    async (start: number) => {
      // Un saut de réplique relance la lecture sans couper le micro, déjà prêt
      controller.current?.abort()
      const ctrl = new AbortController()
      controller.current = ctrl
      const { signal } = ctrl
      setError(null)

      // Micro ouvert dès le début, pour ne pas perdre mes premiers mots
      if (lines.slice(start).some((l) => l.character_id === myRoleId)) listener.current?.start()

      for (let i = start; i < lines.length; i++) {
        if (signal.aborted) return
        setIndex(i)
        const line = lines[i]
        const character = characters.get(line.character_id)

        if (line.character_id === myRoleId) {
          setPhase('listening')
          setTranscript('')
          setRatio(0)
          // Le micro, ouvert en continu, a pu capter la réplique que la synthèse vient de lire
          const before = lines[i - 1]
          const previous = before && before.character_id !== myRoleId ? before.text : null
          await listener.current?.waitForLine(line.text, previous, signal, (heard, r) => {
            setTranscript(heard)
            setRatio(r)
          })
        } else if (character) {
          setPhase('speaking')
          const next = lines.slice(i + 1).find((l) => l.character_id !== myRoleId)
          const nextCharacter = next && characters.get(next.character_id)
          if (next && nextCharacter) engineRef.current.prefetch?.(next.text, nextCharacter)
          try {
            await engineRef.current.speak(line.text, character, signal)
          } catch (e) {
            if (signal.aborted) return
            setError(e instanceof Error ? e.message : String(e))
            setPhase('paused')
            stop()
            return
          }
        }
      }

      if (signal.aborted) return
      stop()
      setIndex(lines.length)
      setPhase('done')
    },
    [characters, lines, myRoleId, setIndex, stop],
  )

  const play = useCallback(() => {
    run(indexRef.current >= lines.length ? 0 : indexRef.current)
  }, [run, lines.length])

  const pause = useCallback(() => {
    stop()
    setPhase('paused')
  }, [stop])

  const restart = useCallback(() => {
    run(0)
  }, [run])

  const goTo = useCallback(
    (i: number) => {
      const target = Math.max(0, Math.min(i, lines.length))
      if (controller.current) run(target)
      else {
        setIndex(target)
        setPhase(target >= lines.length ? 'done' : 'paused')
      }
    },
    [lines.length, run, setIndex],
  )

  const next = useCallback(() => goTo(indexRef.current + 1), [goTo])

  // Arrêt propre en quittant la page ou quand le texte / le rôle change
  useEffect(
    () => () => {
      const running = controller.current !== null
      stop()
      if (running) setPhase('paused')
    },
    [stop, lines, myRoleId],
  )

  return { index, phase, transcript, ratio, micState, micIssue, error, play, pause, restart, goTo, next, stop }
}
