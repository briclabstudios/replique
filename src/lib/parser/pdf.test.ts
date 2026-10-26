import { describe, expect, it } from 'vitest'
import { itemsToParagraphs } from './pdf'

describe('itemsToParagraphs', () => {
  it('regroupe par ligne, ignore les italiques et les numéros de page', () => {
    const items = [
      { str: 'ALCESTE', x: 50, y: 700, italic: false },
      { str: '. Bonjour', x: 110, y: 700.5, italic: false },
      { str: ' (il sort)', x: 180, y: 700, italic: true },
      { str: 'PHILINTE Salut.', x: 50, y: 680, italic: false },
      { str: '12', x: 300, y: 20, italic: false },
    ]
    expect(itemsToParagraphs(items)).toEqual(['ALCESTE. Bonjour', 'PHILINTE Salut.'])
  })
})
