import { describe, expect, it } from 'vitest'
import { coverage, echoDetector, endReached, mergeRepeats, words } from './match'

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

  it('fusionne les répétitions des résultats Android', () => {
    expect(mergeRepeats(['je ne', 'je ne puis', 'je ne puis me repentir'])).toEqual(['je ne puis me repentir'])
    expect(mergeRepeats(['je ne puis', 'je ne puis', 'me repentir'])).toEqual(['je ne puis', 'me repentir'])
    expect(mergeRepeats(['Je ne puis !', 'je ne'])).toEqual(['Je ne puis !'])
    // « je » puis « jeudi » : un mot qui commence pareil n'est pas une répétition
    expect(mergeRepeats(['je', 'jeudi soir'])).toEqual(['je', 'jeudi soir'])
  })

  it('détecte la fin de la réplique', () => {
    expect(endReached('Je ne puis me repentir', 'euh je ne peux me repentir')).toBe(true)
    expect(endReached('Je ne puis me repentir', 'je ne puis')).toBe(false)
  })
})
