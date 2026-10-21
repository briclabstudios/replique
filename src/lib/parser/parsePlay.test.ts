import { describe, expect, it } from 'vitest'
import { extractParagraphs } from './html'
import { guessGender, parsePlay, splitSpeaker } from './parsePlay'

// Reproduit la forme d'un export HTML Google Docs : italique porté par des classes CSS
const GDOC_HTML = `<html><head><meta content="text/html; charset=UTF-8" http-equiv="content-type">
<style type="text/css">.c0{color:#000000;font-weight:400;font-style:normal;font-size:11pt}
.c3{color:#000000;font-weight:400;font-size:11pt;font-family:"Arial";font-style:italic}
.c1{font-weight:700}.c2{padding-top:0pt;line-height:1.15}</style><title>L’Avare</title></head>
<body class="c4 doc-content">
<p class="c2"><span class="c1">L’AVARE</span></p>
<p class="c2"><span class="c0">par Molière</span></p>
<p class="c2"><span class="c0">PERSONNAGES</span></p>
<p class="c2"><span class="c0">HARPAGON, père de Cléante et d’Élise, et amoureux de Mariane.</span></p>
<p class="c2"><span class="c0">CLÉANTE, fils d’Harpagon, amant de Mariane.</span></p>
<p class="c2"><span class="c0">ÉLISE, fille d’Harpagon, amante de Valère.</span></p>
<p class="c2"><span class="c0">VALÈRE, fils d’Anselme, et amant d’Élise.</span></p>
<p class="c2"><span class="c0">LA FLÈCHE, valet de Cléante.</span></p>
<p class="c2"><span class="c0">M. SIMON, courtier.</span></p>
<p class="c2"><span class="c0">ACTE PREMIER</span></p>
<p class="c2"><span class="c0">SCÈNE PREMIÈRE</span></p>
<p class="c2"><span class="c0">VALÈRE, ÉLISE.</span></p>
<p class="c2"><span class="c0">VALÈRE. – Hé quoi ! charmante Élise, vous devenez mélancolique ?</span></p>
<p class="c2"><span class="c3">Il lui prend la main.</span></p>
<p class="c2"><span class="c0">ÉLISE. – Non, Valère, </span><span class="c3">(elle soupire)</span><span class="c0"> je ne puis me repentir.</span></p>
<p class="c2"><span class="c0">Et je vous l’assure.</span></p>
<p class="c2"><span class="c0">VALERE, </span><span class="c3">à part.</span><span class="c0"> – Ah ! je le savais.</span></p>
<p class="c2"><span class="c0">SCÈNE II</span></p>
<p class="c2"><span class="c0">CLÉANTE</span></p>
<p class="c2"><span class="c0">Je suis bien aise de vous trouver seule, ma sœur.</span></p>
<p class="c2"><span class="c0">ÉLISE</span><span class="c3"> (surprise)</span></p>
<p class="c2"><span class="c0">Me voilà prête à vous ouïr.<br>OUI, mon frère.</span></p>
<p class="c2"><span class="c0">ACTE II</span></p>
<p class="c2"><span class="c0">SCÈNE 1 – Chez Harpagon</span></p>
<p class="c2"><span class="c0">M. SIMON. – Monsieur, voici l’affaire.</span></p>
<p class="c2"><span class="c0">HARPAGON : AH ! que dites-vous ?</span></p>
</body></html>`

describe('extractParagraphs', () => {
  it('retire les didascalies en italique, entre et au milieu des répliques', () => {
    const { title, paragraphs } = extractParagraphs(GDOC_HTML)
    expect(title).toBe('L’Avare')
    expect(paragraphs).not.toContain('Il lui prend la main.')
    expect(paragraphs).toContain('ÉLISE. – Non, Valère, je ne puis me repentir.')
    expect(paragraphs).toContain('ÉLISE')
  })

  it('découpe les sauts de ligne en paragraphes', () => {
    const { paragraphs } = extractParagraphs(GDOC_HTML)
    expect(paragraphs).toContain('Me voilà prête à vous ouïr.')
    expect(paragraphs).toContain('OUI, mon frère.')
  })
})

describe('splitSpeaker', () => {
  it.each([
    ['HARPAGON. – Texte', 'HARPAGON', 'Texte'],
    ['LA FLÈCHE : Monsieur', 'LA FLÈCHE', 'Monsieur'],
    ['M. JOURDAIN. – Oui', 'M. JOURDAIN', 'Oui'],
    ['CLÉANTE', 'CLÉANTE', ''],
    ['MAÎTRE JACQUES, Vous', 'MAÎTRE JACQUES', 'Vous'],
  ])('%s', (input, name, rest) => {
    expect(splitSpeaker(input)).toEqual({ name, rest })
  })

  it('ignore les phrases ordinaires et les exclamations', () => {
    expect(splitSpeaker('Je suis bien aise')).toBeNull()
    expect(splitSpeaker('AH ! que dites-vous')).toBeNull()
    expect(splitSpeaker('À demain')).toBeNull()
  })
})

describe('parsePlay', () => {
  const { title, paragraphs } = extractParagraphs(GDOC_HTML)
  const play = parsePlay(paragraphs, title)

  it('lit le titre, l’auteur et la distribution', () => {
    expect(play.title).toBe('L’Avare')
    expect(play.author).toBe('Molière')
    expect(play.characters.map((c) => c.name)).toEqual([
      'HARPAGON', 'CLÉANTE', 'ÉLISE', 'VALÈRE', 'LA FLÈCHE', 'M. SIMON',
    ])
    expect(play.characters.find((c) => c.name === 'CLÉANTE')?.description).toBe('fils d’Harpagon, amant de Mariane.')
  })

  it('découpe actes et scènes', () => {
    expect(play.acts.map((a) => [a.number, a.scenes.map((s) => s.number)])).toEqual([
      [1, [1, 2]],
      [2, [1]],
    ])
    expect(play.acts[1].scenes[0].title).toBe('Chez Harpagon')
  })

  it('attribue les répliques, y compris sur plusieurs paragraphes', () => {
    const [s1, s2] = play.acts[0].scenes
    expect(s1.lines).toEqual([
      { character: 'VALÈRE', text: 'Hé quoi ! charmante Élise, vous devenez mélancolique ?' },
      { character: 'ÉLISE', text: 'Non, Valère, je ne puis me repentir.\nEt je vous l’assure.' },
      // « VALERE » sans accent est fusionné avec VALÈRE
      { character: 'VALÈRE', text: 'Ah ! je le savais.' },
    ])
    expect(s2.lines).toEqual([
      { character: 'CLÉANTE', text: 'Je suis bien aise de vous trouver seule, ma sœur.' },
      // « OUI » n'est pas dans la distribution : c'est la suite de la réplique
      { character: 'ÉLISE', text: 'Me voilà prête à vous ouïr.\nOUI, mon frère.' },
    ])
    expect(play.acts[1].scenes[0].lines.map((l) => l.character)).toEqual(['M. SIMON', 'HARPAGON'])
  })

  it('crée un acte et une scène implicites sans structure', () => {
    const p = parsePlay(['ROMÉO. – Elle parle.', 'JULIETTE. – Hélas !'], null)
    expect(p.acts).toHaveLength(1)
    expect(p.acts[0].scenes[0].lines).toHaveLength(2)
    expect(p.title).toBe('Pièce sans titre')
  })
})

describe('parsePlay — distribution « Liste des personnages : »', () => {
  const play = parsePlay([
    'Liste des personnages :',
    'JOHN-EMERY ROCKEFELLER : 70 ans, dur à cuire.',
    'CAROLINE ROCKEFELLER : sa femme.',
    'ŒIL-DE-LYNX : chef des Comanches.',
    'ACTE PREMIER',
    'Scène I',
    'JOHN-EMERY. - Silence !',
    'CAROLINE. Personne t’empêche.',
    'JOHN -EMERY. - Amen.',
    'OEIL-DE-LYNX. Hugh.',
    'ŒIL-DE-LYNX. Hugh !',
    'RIDEAU',
  ], 'Sassafras')

  it('rattache les noms courts du texte aux noms complets de la distribution', () => {
    expect(play.characters.map((c) => [c.name, c.description])).toEqual([
      ['JOHN-EMERY', '70 ans, dur à cuire.'],
      ['CAROLINE', 'sa femme.'],
      ['ŒIL-DE-LYNX', 'chef des Comanches.'],
    ])
    expect(play.characters[1].gender).toBe('female')
  })

  it('fusionne Œ/OE et les espaces autour des traits d’union, ignore « RIDEAU »', () => {
    expect(play.acts[0].scenes[0].lines.map((l) => l.character)).toEqual([
      'JOHN-EMERY', 'CAROLINE', 'JOHN-EMERY', 'ŒIL-DE-LYNX', 'ŒIL-DE-LYNX',
    ])
  })
})

describe('guessGender', () => {
  it('se base sur la description', () => {
    expect(guessGender('ÉLISE', 'fille d’Harpagon')).toBe('female')
    expect(guessGender('CLÉANTE', 'fils de la comtesse')).toBe('male')
    expect(guessGender('MADAME JOURDAIN', null)).toBe('female')
    expect(guessGender('X', null)).toBe('neutral')
  })
})
