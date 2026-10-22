// Statistiques de visite : une ligne par session, sans IP ni service tiers.
// La localisation est approximée par le fuseau horaire du navigateur.

import { supabase } from './supabase'

const VISITOR_KEY = 'replique:visitor'
const LAST_VISIT_KEY = 'replique:last-visit'
// Une nouvelle session commence après 30 minutes sans ouvrir l'app
const SESSION_GAP_MS = 30 * 60 * 1000

export type Device = 'mobile' | 'tablet' | 'desktop'

export interface ClientInfo {
  device: Device
  os: string
  browser: string
}

/** Type d'appareil, système et navigateur, déduits du user agent. */
export function parseUserAgent(ua: string): ClientInfo {
  const os = /Windows/.test(ua) ? 'Windows'
    : /Android/.test(ua) ? 'Android'
    : /iPhone|iPad|iPod/.test(ua) ? 'iOS'
    : /Mac OS X|Macintosh/.test(ua) ? 'macOS'
    : /CrOS/.test(ua) ? 'ChromeOS'
    : /Linux/.test(ua) ? 'Linux'
    : 'Autre'

  const browser = /Edg\//.test(ua) ? 'Edge'
    : /SamsungBrowser/.test(ua) ? 'Samsung Internet'
    : /OPR\/|Opera/.test(ua) ? 'Opera'
    : /Firefox|FxiOS/.test(ua) ? 'Firefox'
    : /Chrome|CriOS/.test(ua) ? 'Chrome'
    : /Safari/.test(ua) ? 'Safari'
    : 'Autre'

  const device: Device = /iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua)) ? 'tablet'
    : /Mobi|iPhone|iPod|Android/.test(ua) ? 'mobile'
    : 'desktop'

  return { device, os, browser }
}

function visitorId(): string {
  let id = localStorage.getItem(VISITOR_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(VISITOR_KEY, id)
  }
  return id
}

/** Enregistre la visite si c'est une nouvelle session. N'échoue jamais : les stats ne doivent pas gêner l'app. */
export async function trackVisit() {
  if (import.meta.env.DEV) return
  try {
    const now = Date.now()
    const last = Number(localStorage.getItem(LAST_VISIT_KEY) ?? 0)
    localStorage.setItem(LAST_VISIT_KEY, String(now))
    if (now - last < SESSION_GAP_MS) return

    // iPad récent : se présente comme un Mac, mais a un écran tactile
    const info = parseUserAgent(navigator.userAgent)
    if (info.os === 'macOS' && navigator.maxTouchPoints > 1) Object.assign(info, { os: 'iOS', device: 'tablet' })

    await supabase.from('visits').insert({
      visitor_id: visitorId(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
      language: navigator.language,
      ...info,
      standalone:
        window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true,
      screen: `${window.screen.width}×${window.screen.height}`,
    })
  } catch {
    // stockage ou réseau indisponible : visite non comptée
  }
}

export interface VisitRow {
  value: string
  sessions: number
  visitors: number
}

export interface VisitStats {
  sessions: number
  visitors: number
  new_visitors: number
  daily: { day: string; sessions: number; visitors: number }[]
  breakdown: Partial<Record<'timezone' | 'device' | 'os' | 'browser' | 'language' | 'mode', VisitRow[]>>
  recent: { created_at: string; timezone: string | null; device: Device | null; os: string | null; browser: string | null; standalone: boolean }[]
}

export async function fetchVisitStats(days: number): Promise<VisitStats> {
  const { data, error } = await supabase.rpc('visit_stats', { p_days: days })
  if (error) throw new Error(error.message)
  return data as VisitStats
}
