import { supabase } from './supabase'
import type { ParsedPlay } from './parser/parsePlay'
import type { Act, Character, Line, Play, Scene, TtsSettings } from './types'

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}

export interface PlaySummary extends Play {
  characters: Pick<Character, 'id' | 'name' | 'position'>[]
  acts: { count: number }[]
  scenes: { count: number }[]
}

export async function listPlays(): Promise<PlaySummary[]> {
  return check(
    await supabase
      .from('plays')
      .select('*, characters(id, name, position), acts(count), scenes(count)')
      .order('created_at', { ascending: false }),
  ) as PlaySummary[]
}

export async function getPlay(id: string): Promise<Play> {
  return check(await supabase.from('plays').select('*').eq('id', id).single())
}

export async function updatePlay(id: string, patch: Partial<Pick<Play, 'title' | 'author' | 'status'>>) {
  check(await supabase.from('plays').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id))
}

export async function deletePlay(id: string) {
  check(await supabase.from('plays').delete().eq('id', id))
}

export type CharacterWithCount = Character & { lines: { count: number }[] }

export async function getCharacters(playId: string): Promise<CharacterWithCount[]> {
  return check(
    await supabase.from('characters').select('*, lines(count)').eq('play_id', playId).order('position'),
  ) as CharacterWithCount[]
}

export async function updateCharacter(id: string, patch: Partial<Omit<Character, 'id' | 'play_id'>>) {
  check(await supabase.from('characters').update(patch).eq('id', id))
}

export async function deleteCharacter(id: string) {
  check(await supabase.from('characters').delete().eq('id', id))
}

export async function mergeCharacter(sourceId: string, targetId: string) {
  check(await supabase.rpc('merge_character', { p_source: sourceId, p_target: targetId }))
}

export async function getStructure(playId: string): Promise<{ acts: Act[]; scenes: Scene[] }> {
  const [acts, scenes] = await Promise.all([
    supabase.from('acts').select('*').eq('play_id', playId).order('position'),
    supabase.from('scenes').select('*').eq('play_id', playId).order('position'),
  ])
  return { acts: check(acts), scenes: check(scenes) }
}

/** Personnages qui parlent dans chaque scène, par ordre de première réplique. */
export async function getSceneCasts(playId: string): Promise<Map<string, string[]>> {
  const rows: { id: string; lines: { character_id: string | null }[] }[] = check(
    await supabase
      .from('scenes')
      .select('id, lines(character_id, position)')
      .eq('play_id', playId)
      .order('position', { referencedTable: 'lines' }),
  )
  return new Map(
    rows.map((s) => [s.id, [...new Set(s.lines.map((l) => l.character_id).filter((id): id is string => !!id))]]),
  )
}

export async function getScene(sceneId: string): Promise<{ scene: Scene; act: Act; lines: Line[] }> {
  const scene: Scene = check(await supabase.from('scenes').select('*').eq('id', sceneId).single())
  const [act, lines] = await Promise.all([
    supabase.from('acts').select('*').eq('id', scene.act_id).single(),
    supabase.from('lines').select('*').eq('scene_id', sceneId).order('position'),
  ])
  return { scene, act: check(act), lines: check(lines) }
}

export async function updateLine(id: string, patch: Partial<Pick<Line, 'text' | 'character_id'>>) {
  check(await supabase.from('lines').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id))
}

export async function deleteLine(id: string) {
  check(await supabase.from('lines').delete().eq('id', id))
}

export async function insertLine(line: Omit<Line, 'id'>): Promise<Line> {
  return check(await supabase.from('lines').insert(line).select().single())
}

/** Enregistre une pièce analysée en une seule transaction (fonction SQL import_play). */
export async function importPlay(parsed: ParsedPlay, sourceUrl: string): Promise<string> {
  const playId = crypto.randomUUID()
  const characterIds = new Map(parsed.characters.map((c) => [c.name, crypto.randomUUID()]))
  const acts: object[] = []
  const scenes: object[] = []
  const lines: object[] = []

  parsed.acts.forEach((act, actIndex) => {
    const actId = crypto.randomUUID()
    acts.push({ id: actId, number: act.number, title: act.title, position: actIndex })
    act.scenes.forEach((scene) => {
      const sceneId = crypto.randomUUID()
      scenes.push({ id: sceneId, act_id: actId, number: scene.number, title: scene.title, position: scenes.length })
      scene.lines.forEach((line, lineIndex) => {
        lines.push({
          scene_id: sceneId,
          character_id: characterIds.get(line.character),
          position: (lineIndex + 1) * 10,
          text: line.text,
        })
      })
    })
  })

  const payload = {
    id: playId,
    title: parsed.title,
    author: parsed.author,
    source_url: sourceUrl,
    characters: parsed.characters.map((c, i) => ({
      id: characterIds.get(c.name),
      name: c.name,
      description: c.description,
      gender: c.gender,
      position: i,
    })),
    acts,
    scenes,
    lines,
  }
  check(await supabase.rpc('import_play', { payload }))
  return playId
}

export const DEFAULT_TTS: TtsSettings = { provider: 'browser', openaiModel: 'gpt-4o-mini-tts', speed: 1.2 }

export async function getTtsSettings(): Promise<TtsSettings> {
  const res = await supabase.from('app_settings').select('value').eq('key', 'tts').maybeSingle()
  if (res.error || !res.data) return DEFAULT_TTS
  return { ...DEFAULT_TTS, ...(res.data.value as Partial<TtsSettings>) }
}

export async function saveTtsSettings(settings: TtsSettings) {
  check(
    await supabase
      .from('app_settings')
      .upsert({ key: 'tts', value: settings, updated_at: new Date().toISOString() }),
  )
}
