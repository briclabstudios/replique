import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { DEFAULT_TTS, getTtsSettings } from '../lib/api'
import { getDeviceSetting, setDeviceSetting } from '../lib/storage'
import { createEngine, type TtsEngine } from '../lib/tts'
import type { TtsSettings } from '../lib/types'

interface SettingsValue {
  tts: TtsSettings
  engine: TtsEngine
  /** Débit de parole propre à cet appareil, mémorisé en local et commun à toutes les scènes (1 = normal). */
  mySpeed: number
  setMySpeed: (speed: number) => void
  reload: () => Promise<void>
}

const SettingsContext = createContext<SettingsValue | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [tts, setTts] = useState<TtsSettings>(DEFAULT_TTS)
  const [mySpeed, setMySpeedState] = useState(() => getDeviceSetting('speed', 1))

  const setMySpeed = useCallback((speed: number) => {
    setMySpeedState(speed)
    setDeviceSetting('speed', speed)
  }, [])

  const reload = useCallback(async () => {
    setTts(await getTtsSettings())
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const engine = useMemo(() => createEngine({ ...tts, speed: mySpeed }), [tts, mySpeed])
  const value = useMemo(() => ({ tts, engine, mySpeed, setMySpeed, reload }), [tts, engine, mySpeed, setMySpeed, reload])
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsValue {
  const value = useContext(SettingsContext)
  if (!value) throw new Error('useSettings doit être utilisé dans SettingsProvider')
  return value
}
