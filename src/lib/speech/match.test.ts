import { describe, expect, it } from 'vitest'
import { coverage, echoDetector, endReached, words } from './match'

describe('match', () => {
  it('normalise accents, apostrophes et ponctuation', () => {
    expect(words('Hé quoi ! L’Élise, déjà ?')).toEqual(['he', 'quoi', 'l', 'elise', 'deja'])
  })

  it('mesure la part des mots attendus entendus', () => {
    expect(coverage('Je ne puis me repentir', 'je ne puis me repentir')).toBe(1)
    expect(coverage('Je ne puis me repentir', 'je puis repentir')).toBeCloseTo(0.6)
    expect(coverage('Je ne puis me repentir', '')).toBe(0)
  })

  it('reconnaît l’écho de la réplique précédente', () => {
    const isEcho = echoDetector('Hé quoi ! charmante Élise, vous devenez mélancolique ?')
    expect(isEcho('charmante Élise vous devenez')).toBe(true)
    expect(isEcho('non Valère je ne puis me repentir')).toBe(false)
    // Un mot isolé (« Élise ») peut être le début de ma réplique : jamais un écho
    expect(isEcho('Élise')).toBe(false)
  })

  it('détecte la fin de la réplique', () => {
    expect(endReached('Je ne puis me repentir', 'euh je ne peux me repentir')).toBe(true)
    expect(endReached('Je ne puis me repentir', 'je ne puis')).toBe(false)
  })
})
