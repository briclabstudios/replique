import { describe, expect, it } from 'vitest'
import { coverage, endReached, words } from './match'

describe('match', () => {
  it('normalise accents, apostrophes et ponctuation', () => {
    expect(words('Hé quoi ! L’Élise, déjà ?')).toEqual(['he', 'quoi', 'l', 'elise', 'deja'])
  })

  it('mesure la part des mots attendus entendus', () => {
    expect(coverage('Je ne puis me repentir', 'je ne puis me repentir')).toBe(1)
    expect(coverage('Je ne puis me repentir', 'je puis repentir')).toBeCloseTo(0.6)
    expect(coverage('Je ne puis me repentir', '')).toBe(0)
  })

  it('détecte la fin de la réplique', () => {
    expect(endReached('Je ne puis me repentir', 'euh je ne peux me repentir')).toBe(true)
    expect(endReached('Je ne puis me repentir', 'je ne puis')).toBe(false)
  })
})
