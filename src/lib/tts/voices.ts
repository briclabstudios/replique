import { getCharacterVoice } from '../storage'
import type { Character, Gender } from '../types'

/** Tons proposés pour chaque personnage : réglage débit/hauteur (navigateur) et consigne (OpenAI). */
export const TONES: Record<string, { label: string; rate: number; pitch: number; instruction: string }> = {
  neutre: { label: 'Neutre', rate: 1, pitch: 1, instruction: 'Ton naturel et posé.' },
  joyeux: { label: 'Joyeux', rate: 1.08, pitch: 1.15, instruction: 'Ton enjoué, souriant, plein d’entrain.' },
  colerique: { label: 'Colérique', rate: 1.12, pitch: 0.9, instruction: 'Ton irrité, sec, prompt à s’emporter.' },
  triste: { label: 'Mélancolique', rate: 0.88, pitch: 0.92, instruction: 'Ton triste, voix basse et lente.' },
  timide: { label: 'Timide', rate: 0.92, pitch: 1.1, instruction: 'Ton hésitant, doux, un peu effacé.' },
  autoritaire: { label: 'Autoritaire', rate: 0.95, pitch: 0.85, instruction: 'Ton ferme, assuré, qui commande.' },
  age: { label: 'Âgé', rate: 0.85, pitch: 0.82, instruction: 'Voix d’une personne âgée, un peu chevrotante.' },
  jeune: { label: 'Jeune', rate: 1.1, pitch: 1.2, instruction: 'Voix jeune, vive et spontanée.' },
  ironique: { label: 'Ironique', rate: 1, pitch: 1.05, instruction: 'Ton moqueur et sarcastique.' },
  solennel: { label: 'Solennel', rate: 0.85, pitch: 0.9, instruction: 'Ton grave, solennel, déclamatoire.' },
  passionne: { label: 'Passionné', rate: 1.05, pitch: 1.05, instruction: 'Ton ardent, lyrique, plein d’émotion.' },
}

export function toneOf(character: Pick<Character, 'tone'>) {
  return TONES[character.tone] ?? TONES.neutre
}

// Voix OpenAI regroupées par timbre
const OPENAI_VOICES: Record<Gender, string[]> = {
  male: ['onyx', 'ash', 'echo', 'verse', 'ballad'],
  female: ['nova', 'coral', 'shimmer', 'sage'],
  neutral: ['alloy', 'fable'],
}

export function openAiVoice(character: Pick<Character, 'gender' | 'position'>): string {
  const voices = OPENAI_VOICES[character.gender]
  return voices[character.position % voices.length]
}

export function openAiInstructions(character: Pick<Character, 'name' | 'tone' | 'personality' | 'description'>): string {
  const parts = [
    'Tu joues un rôle dans une pièce de théâtre, en français. Dis le texte exactement, avec le jeu d’un comédien.',
    `Personnage : ${character.name}.`,
    character.description ? `Rôle : ${character.description}` : '',
    character.personality ? `Personnalité : ${character.personality}` : '',
    toneOf(character).instruction,
  ]
  return parts.filter(Boolean).join(' ')
}

// Prénoms usuels des voix système françaises (Windows, macOS, Android, Chrome)
const MALE_VOICE = /(thomas|paul|henri|claude|r[ée]my|antoine|jean|nicolas|daniel|guillaume|mathieu|yves|fabrice|g[ée]rard|alain|j[ée]r[ôo]me|maxime|vincent|eddy|reed|grandpa|rocko|male|homme)/i
const FEMALE_VOICE = /(hortense|julie|denise|am[ée]lie|audrey|aur[ée]lie|marie|sylvie|[ée]lo[ïi]se|jos[ée]phine|vivienne|brigitte|c[ée]leste|charline|coralie|jacqueline|yvette|elsa|virginie|caroline|ariane|sandy|shelley|flo|grandma|female|femme|google fran)/i

export function voiceGender(voice: SpeechSynthesisVoice): Gender {
  if (FEMALE_VOICE.test(voice.name)) return 'female'
  if (MALE_VOICE.test(voice.name)) return 'male'
  return 'neutral'
}

export function frenchVoices(): SpeechSynthesisVoice[] {
  if (!('speechSynthesis' in window)) return []
  return speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('fr'))
}

/**
 * Choisit une voix système pour un personnage : celle choisie sur cet appareil si elle existe,
 * sinon même genre si possible, et des voix différentes d'un personnage à l'autre.
 * Quand il y a peu de voix, la hauteur varie.
 */
export function browserVoice(character: Pick<Character, 'id' | 'gender' | 'position' | 'tone'>) {
  const voices = frenchVoices()
  const tone = toneOf(character)
  const preferred = getCharacterVoice(character.id)
  const chosen = preferred ? speechSynthesis.getVoices().find((v) => v.voiceURI === preferred) : undefined
  if (chosen) return { voice: chosen, rate: tone.rate, pitch: tone.pitch }

  const sameGender = voices.filter((v) => voiceGender(v) === character.gender)
  const pool = sameGender.length > 0 ? sameGender : voices
  const voice = pool[character.position % Math.max(pool.length, 1)] ?? null
  const cycle = Math.floor(character.position / Math.max(pool.length, 1))
  const pitchShift = [0, -0.12, 0.12, -0.2, 0.2][cycle % 5]
  // Sans voix masculine installée, une voix plus grave approche mieux un homme
  const genderShift = sameGender.length === 0 && character.gender === 'male' ? -0.25 : 0
  return {
    voice,
    rate: tone.rate,
    pitch: Math.min(2, Math.max(0.1, tone.pitch + pitchShift + genderShift)),
  }
}

/** Les voix du navigateur se chargent de façon asynchrone (Chrome). */
export function voicesReady(): Promise<void> {
  if (!('speechSynthesis' in window)) return Promise.resolve()
  if (speechSynthesis.getVoices().length > 0) return Promise.resolve()
  return new Promise((resolve) => {
    const done = () => resolve()
    speechSynthesis.addEventListener('voiceschanged', done, { once: true })
    setTimeout(done, 1500)
  })
}
