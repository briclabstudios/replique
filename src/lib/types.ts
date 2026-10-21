export type Gender = 'male' | 'female' | 'neutral'

export interface Play {
  id: string
  title: string
  author: string | null
  source_url: string | null
  status: 'draft' | 'ready'
  created_at: string
}

export interface Character {
  id: string
  play_id: string
  name: string
  description: string | null
  personality: string | null
  gender: Gender
  tone: string
  position: number
}

export interface Act {
  id: string
  play_id: string
  number: number
  title: string | null
  position: number
}

export interface Scene {
  id: string
  play_id: string
  act_id: string
  number: number
  title: string | null
  position: number
}

export interface Line {
  id: string
  play_id: string
  scene_id: string
  character_id: string
  position: number
  text: string
}

export interface TtsSettings {
  provider: 'browser' | 'openai'
  openaiModel: string
  /** Multiplicateur du débit de parole, appliqué à toutes les voix (1 = normal). */
  speed: number
}
