import { useCallback, useEffect, useRef, useState } from 'react'
import { listenForLine } from '../lib/speech/listener'
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
  const controller = useRef<AbortController | null>(null)
  const indexRef = useRef(index)

  const setIndex = useCallback(
    (i: number) => {
      indexRef.current = i
      setIndexState(i)
      setSceneProgress(playId, sceneId, i >= lines.length ? null : i)
    },
    [playId, sceneId, lines.length],
  )

  const stop = useCallback(() => {
    controller.current?.abort()
    controller.current = null
  }, [])

  const run = useCallback(
    async (start: number) => {
      stop()
      const ctrl = new AbortController()
      controller.current = ctrl
      const { signal } = ctrl
      setError(null)

      for (let i = start; i < lines.length; i++) {
        if (signal.aborted) return
        setIndex(i)
        const line = lines[i]
        const character = characters.get(line.character_id)

        if (line.character_id === myRoleId) {
          setPhase('listening')
          setTranscript('')
          setRatio(0)
          await listenForLine(line.text, {
            signal,
            onProgress: (heard, r) => {
              setTranscript(heard)
              setRatio(r)
            },
            onUnavailable: setMicIssue,
          })
        } else if (character) {
          setPhase('speaking')
          const next = lines.slice(i + 1).find((l) => l.character_id !== myRoleId)
          const nextCharacter = next && characters.get(next.character_id)
          if (next && nextCharacter) engine.prefetch?.(next.text, nextCharacter)
          try {
            await engine.speak(line.text, character, signal)
          } catch (e) {
            if (signal.aborted) return
            setError(e instanceof Error ? e.message : String(e))
            setPhase('paused')
            controller.current = null
            return
          }
        }
      }

      if (signal.aborted) return
      controller.current = null
      setIndex(lines.length)
      setPhase('done')
    },
    [characters, engine, lines, myRoleId, setIndex, stop],
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
      if (!controller.current) return
      stop()
      setPhase('paused')
    },
    [stop, lines, myRoleId],
  )

  return { index, phase, transcript, ratio, micIssue, error, play, pause, restart, goTo, next, stop }
}
