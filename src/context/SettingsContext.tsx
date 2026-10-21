import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { DEFAULT_TTS, getTtsSettings } from '../lib/api'
import { createEngine, type TtsEngine } from '../lib/tts'
import type { TtsSettings } from '../lib/types'

interface SettingsValue {
  tts: TtsSettings
  engine: TtsEngine
  reload: () => Promise<void>
}

const SettingsContext = createContext<SettingsValue | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [tts, setTts] = useState<TtsSettings>(DEFAULT_TTS)

  const reload = useCallback(async () => {
    setTts(await getTtsSettings())
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const engine = useMemo(() => createEngine(tts), [tts])
  const value = useMemo(() => ({ tts, engine, reload }), [tts, engine, reload])
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsValue {
  const value = useContext(SettingsContext)
  if (!value) throw new Error('useSettings doit être utilisé dans SettingsProvider')
  return value
}
