import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchGoogleDocHtml, googleDocId } from './gdoc'

const DOC = '<html><head></head><body><p>HARPAGON. – Texte</p></body></html>'

describe('googleDocId', () => {
  it('extrait l’identifiant d’un lien de partage', () => {
    expect(googleDocId('https://docs.google.com/document/d/1UbUf2l2aZNt6Yz4Drhq99NMNXH2ITgGQiiKnzLIjXU0/edit?usp=sharing'))
      .toBe('1UbUf2l2aZNt6Yz4Drhq99NMNXH2ITgGQiiKnzLIjXU0')
  })
})

describe('fetchGoogleDocHtml', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('accepte le HTML servi en text/plain par la fonction Supabase', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(DOC, { headers: { 'Content-Type': 'text/plain' } })))
    await expect(fetchGoogleDocHtml('x'.repeat(30))).resolves.toBe(DOC)
  })

  it('remonte le message d’erreur de la fonction', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'Document privé.' }, { status: 403 })))
    await expect(fetchGoogleDocHtml('x'.repeat(30))).rejects.toThrow('Document privé.')
  })

  it('refuse une réponse qui n’est pas un document', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('ok')))
    await expect(fetchGoogleDocHtml('x'.repeat(30))).rejects.toThrow('Réponse inattendue')
  })
})
