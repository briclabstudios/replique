// Analyse d'une pièce à partir de paragraphes déjà débarrassés des didascalies.
// Règles : le nom du personnage qui parle est en MAJUSCULES en début de paragraphe,
// suivi de sa réplique sur la même ligne ou sur les paragraphes suivants.

import type { Gender } from '../types'

export interface ParsedLine {
  character: string
  text: string
}

export interface ParsedScene {
  number: number
  title: string | null
  lines: ParsedLine[]
}

export interface ParsedAct {
  number: number
  title: string | null
  scenes: ParsedScene[]
}

export interface ParsedCharacter {
  name: string
  description: string | null
  gender: Gender
}

export interface ParsedPlay {
  title: string
  author: string | null
  characters: ParsedCharacter[]
  acts: ParsedAct[]
}

const ORDINALS: Record<string, number> = {
  premier: 1, premiere: 1, unique: 1, i: 1,
  deuxieme: 2, second: 2, seconde: 2,
  troisieme: 3, quatrieme: 4, cinquieme: 5, sixieme: 6, septieme: 7, huitieme: 8, neuvieme: 9, dixieme: 10,
  onzieme: 11, douzieme: 12, treizieme: 13, quatorzieme: 14, quinzieme: 15, seizieme: 16,
}

const NUMBER = '([IVXLCDM]+|\\d+|[A-Za-zÀ-ÿ]+)'
const ACT_RE = new RegExp(`^ACTE\\s+${NUMBER}\\b\\.?\\s*[-–—:.]?\\s*(.*)$`, 'i')
const SCENE_RE = new RegExp(`^SC[ÈE]NE\\s+${NUMBER}\\b\\.?\\s*[-–—:.]?\\s*(.*)$`, 'i')
const CAST_HEADING_RE = /^(liste\s+des\s+|les\s+)?(personnages|distribution|dramatis\s+personae)\s*[.:]?$/i
const AUTHOR_RE = /^(?:de|par)\s+(.{2,80})$/i

// Abréviations en majuscules qui font partie d'un nom (« M. JOURDAIN »)
const NAME_ABBREVIATIONS = new Set(['M', 'MM', 'ME', 'MGR', 'DR', 'ST', 'STE'])
const MAX_NAME_WORDS = 5
const MAX_NAME_LENGTH = 40

export function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** Clé de comparaison des noms : sans accents ni ligatures, espaces autour des traits d'union ignorés. */
function nameKey(name: string): string {
  return stripAccents(name)
    .toUpperCase()
    .replace(/Œ/g, 'OE')
    .replace(/Æ/g, 'AE')
    .replace(/[’']/g, "'")
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

function romanToInt(roman: string): number | null {
  const values: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 }
  const s = roman.toUpperCase()
  if (!/^[IVXLCDM]+$/.test(s)) return null
  let total = 0
  for (let i = 0; i < s.length; i++) {
    const v = values[s[i]]
    const next = values[s[i + 1]] ?? 0
    total += v < next ? -v : v
  }
  return total
}

function parseNumber(token: string): number | null {
  if (/^\d+$/.test(token)) return Number(token)
  const roman = romanToInt(token)
  if (roman) return roman
  return ORDINALS[stripAccents(token).toLowerCase()] ?? null
}

function matchHeading(re: RegExp, text: string): { number: number; title: string | null } | null {
  const m = re.exec(text)
  if (!m) return null
  const number = parseNumber(m[1])
  if (number === null) return null
  const title = m[2].replace(/^[\s.:–—-]+/, '').trim()
  return { number, title: title || null }
}

const isHeading = (text: string) => matchHeading(ACT_RE, text) !== null || matchHeading(SCENE_RE, text) !== null

function isUpperWord(word: string): boolean {
  return /^[\p{Lu}\d'’-]+$/u.test(word) && /\p{Lu}/u.test(word)
}

/** Sépare « NOM. – Réplique » en { name, rest }, ou null si le paragraphe ne commence pas par un nom. */
export function splitSpeaker(text: string): { name: string; rest: string } | null {
  const words = text.split(/\s+/)
  const nameWords: string[] = []
  let i = 0
  for (; i < words.length; i++) {
    const word = words[i]
    if (/^[–—:-]+$/.test(word)) {
      i++
      break
    }
    const core = word.replace(/[.,:;]+$/, '')
    if (!isUpperWord(core)) break
    const abbreviation = word === `${core}.` && NAME_ABBREVIATIONS.has(core)
    nameWords.push(abbreviation ? word : core)
    if (/[.,:;]$/.test(word) && !abbreviation) {
      i++
      break
    }
  }

  if (nameWords.length === 0 || nameWords.length > MAX_NAME_WORDS) return null
  const name = nameWords.join(' ').replace(/[-’']+$/, '')
  if (name.length > MAX_NAME_LENGTH) return null
  if ((name.match(/\p{L}/gu) ?? []).length < 2) return null

  const rest = words.slice(i).join(' ').replace(/^[\s.,:;–—-]+/, '').trim()
  // « AH ! que… » : une exclamation en majuscules n'est pas un nom de personnage
  if (/^[!?…]/.test(rest)) return null
  return { name, rest }
}

/** Liste des personnages présents en tête de scène : « HARPAGON, CLÉANTE, ÉLISE. » */
function isSceneCastList(text: string): boolean {
  const withoutEt = text.replace(/\bet\b/g, ',')
  if (/\p{Ll}/u.test(withoutEt)) return false
  return /,/.test(withoutEt) && /\p{Lu}{2}/u.test(withoutEt)
}

const FEMALE_RE = /\b(fille|m[èe]re|femme|servante|s(?:oe|œ)ur|tante|veuve|comtesse|marquise|duchesse|reine|princesse|amante|ma[îi]tresse|nourrice|suivante|dame|demoiselle|baronne|berg[èe]re|actrice|cousine|ni[èe]ce|[ée]pouse|amoureuse|madame|mademoiselle)\b/i
const MALE_RE = /\b(fils|p[èe]re|mari|valet|fr[èe]re|oncle|comte|marquis|duc|roi|prince|amant|ma[îi]tre|serviteur|seigneur|baron|berger|acteur|cousin|neveu|[ée]poux|amoureux|homme|cuisinier|cocher|commissaire|notaire|m[ée]decin|laquais|monsieur)\b/i

export function guessGender(name: string, description: string | null): Gender {
  if (/^(MADAME|MME|MADEMOISELLE|MLLE)\b/i.test(name)) return 'female'
  if (/^(MONSIEUR|M\.|MAÎTRE|MAITRE)\s/i.test(name)) return 'male'
  if (!description) return 'neutral'
  const f = FEMALE_RE.exec(description)
  const m = MALE_RE.exec(description)
  if (f && (!m || f.index < m.index)) return 'female'
  if (m) return 'male'
  return 'neutral'
}

export function parsePlay(paragraphs: string[], docTitle: string | null = null): ParsedPlay {
  const hasStructure = paragraphs.some(isHeading)

  // 1) Préambule (avant le premier acte / la première scène) : titre, auteur, distribution
  let title: string | null = docTitle
  let author: string | null = null
  const cast = new Map<string, { name: string; description: string | null }>()
  let bodyStart = 0

  if (hasStructure) {
    let castMode = false
    for (; bodyStart < paragraphs.length; bodyStart++) {
      const p = paragraphs[bodyStart]
      if (isHeading(p)) break
      const authorMatch = AUTHOR_RE.exec(p)
      if (!author && authorMatch) {
        author = authorMatch[1].trim()
        continue
      }
      if (CAST_HEADING_RE.test(p)) {
        castMode = true
        continue
      }
      if (!title) {
        title = p
        continue
      }
      if (castMode) {
        const sp = splitSpeaker(p)
        if (sp && !cast.has(nameKey(sp.name))) {
          cast.set(nameKey(sp.name), { name: sp.name, description: sp.rest || null })
        }
      }
    }
  }

  const body = paragraphs.slice(bodyStart)

  // 2) Premier passage : fréquence des noms candidats, pour écarter les faux positifs
  const counts = new Map<string, number>()
  for (const p of body) {
    if (isHeading(p) || isSceneCastList(p)) continue
    const sp = splitSpeaker(p)
    if (sp) counts.set(nameKey(sp.name), (counts.get(nameKey(sp.name)) ?? 0) + 1)
  }
  /** Entrée de la distribution d'un nom du texte : identique, ou plus complète (« JOHN-EMERY » → « JOHN-EMERY ROCKEFELLER »). */
  const castKeyFor = (key: string): string | null => {
    if (cast.has(key)) return key
    const longer = [...cast.keys()].filter((ck) => ck.startsWith(`${key} `))
    return longer.length === 1 ? longer[0] : null
  }
  const isSpeaker = (name: string) => {
    if (cast.size === 0) return true
    const key = nameKey(name)
    return castKeyFor(key) !== null || (counts.get(key) ?? 0) >= 2
  }

  // 3) Second passage : actes, scènes et répliques
  const acts: ParsedAct[] = []
  const spellings = new Map<string, Map<string, number>>()
  const firstSeen: string[] = []
  let act: ParsedAct | null = null
  let scene: ParsedScene | null = null
  let turn: ParsedLine | null = null
  let sceneJustStarted = false

  const flush = () => {
    if (turn && turn.text.trim()) scene?.lines.push({ character: turn.character, text: turn.text.trim() })
    turn = null
  }
  const ensureAct = () => {
    if (!act) {
      act = { number: 1, title: null, scenes: [] }
      acts.push(act)
    }
    return act
  }
  const ensureScene = () => {
    if (!scene) {
      const a = ensureAct()
      scene = { number: a.scenes.length + 1, title: null, lines: [] }
      a.scenes.push(scene)
    }
    return scene
  }

  for (const p of body) {
    const actHeading = matchHeading(ACT_RE, p)
    if (actHeading) {
      flush()
      act = { number: actHeading.number, title: actHeading.title, scenes: [] }
      acts.push(act)
      scene = null
      continue
    }
    const sceneHeading = matchHeading(SCENE_RE, p)
    if (sceneHeading) {
      flush()
      scene = { number: sceneHeading.number, title: sceneHeading.title, lines: [] }
      ensureAct().scenes.push(scene)
      sceneJustStarted = true
      continue
    }
    if (sceneJustStarted) {
      sceneJustStarted = false
      if (isSceneCastList(p)) continue
    }

    const sp = splitSpeaker(p)
    if (sp && isSpeaker(sp.name)) {
      flush()
      ensureScene()
      const key = nameKey(sp.name)
      if (!spellings.has(key)) {
        spellings.set(key, new Map())
        firstSeen.push(key)
      }
      const variants = spellings.get(key)!
      variants.set(sp.name, (variants.get(sp.name) ?? 0) + 1)
      turn = { character: key, text: sp.rest }
    } else if (turn) {
      const current: ParsedLine = turn
      current.text = current.text ? `${current.text}\n${p}` : p
    }
  }
  flush()

  // 4) Personnages : ordre de la distribution, puis ordre d'apparition.
  // Les variantes (CLEANTE / CLÉANTE, ŒIL / OEIL) sont fusionnées sous l'orthographe la plus fréquente,
  // et un nom du texte plus court que celui de la distribution lui est rattaché.
  const lineCount = new Map<string, number>()
  for (const a of acts) {
    for (const s of a.scenes) {
      for (const l of s.lines) lineCount.set(l.character, (lineCount.get(l.character) ?? 0) + 1)
    }
  }
  const speakerForCast = new Map<string, string>()
  for (const exact of [true, false]) {
    for (const key of firstSeen) {
      const ck = castKeyFor(key)
      if (ck && (ck === key) === exact && !speakerForCast.has(ck)) speakerForCast.set(ck, key)
    }
  }
  const entries: { key: string; castKey: string | null }[] = [...cast.keys()].map((ck) => ({
    key: speakerForCast.get(ck) ?? ck,
    castKey: ck,
  }))
  const used = new Set(entries.map((e) => e.key))
  // Hors distribution, seuls les noms qui ont au moins une réplique comptent (pas de « RIDEAU »)
  for (const key of firstSeen) {
    if (!used.has(key) && (lineCount.get(key) ?? 0) > 0) entries.push({ key, castKey: null })
  }

  const displayName = (key: string, castKey: string | null) => {
    const castName = castKey ? cast.get(castKey)?.name : undefined
    const variants = spellings.get(key)
    if (!variants) return castName ?? key
    const best = [...variants.entries()].sort((a, b) => b[1] - a[1])[0][0]
    return castName && variants.has(castName) ? castName : best
  }
  const characters: ParsedCharacter[] = entries.map(({ key, castKey }) => {
    const description = castKey ? cast.get(castKey)?.description ?? null : null
    const name = displayName(key, castKey)
    return { name, description, gender: guessGender(name, description) }
  })
  const nameByKey = new Map(entries.map((e, i) => [e.key, characters[i].name]))
  for (const a of acts) {
    for (const s of a.scenes) {
      for (const l of s.lines) l.character = nameByKey.get(l.character) ?? l.character
    }
  }

  return {
    title: title?.trim() || 'Pièce sans titre',
    author,
    characters,
    acts: acts.filter((a) => a.scenes.length > 0),
  }
}
