// Données propres à cet appareil : mon rôle et la progression des répétitions.
// Le stockage local peut être indisponible (navigation privée) : on ne plante jamais.

const PREFIX = 'replique:'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null || value === undefined) localStorage.removeItem(PREFIX + key)
    else localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // stockage indisponible : la valeur reste en mémoire pour la session
  }
  window.dispatchEvent(new CustomEvent('replique:storage', { detail: key }))
}

export function getMyRole(playId: string): string | null {
  return read<string | null>(`role:${playId}`, null)
}

export function setMyRole(playId: string, characterId: string | null) {
  write(`role:${playId}`, characterId)
}

/** Index de la réplique en cours, par scène. */
export type Progress = Record<string, number>

export function getProgress(playId: string): Progress {
  return read<Progress>(`progress:${playId}`, {})
}

export function setSceneProgress(playId: string, sceneId: string, index: number | null) {
  const progress = getProgress(playId)
  if (index === null || index <= 0) delete progress[sceneId]
  else progress[sceneId] = index
  write(`progress:${playId}`, progress)
}

export function clearPlayData(playId: string) {
  write(`role:${playId}`, null)
  write(`progress:${playId}`, null)
}

export function getDeviceSetting<T>(key: string, fallback: T): T {
  return read<T>(`setting:${key}`, fallback)
}

export function setDeviceSetting(key: string, value: unknown) {
  write(`setting:${key}`, value)
}
