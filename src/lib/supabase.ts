import { createClient } from '@supabase/supabase-js'

// Clé publishable : publique par nature, protégée par les règles RLS. Surchargeable via .env.local
export const supabaseUrl: string | undefined =
  import.meta.env.VITE_SUPABASE_URL || 'https://gjhcwtmuybmfgnjycpex.supabase.co'
export const supabaseAnonKey: string | undefined =
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_K7aoDLMVIqMY3MkrOl0wog_f0O9qf77'
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

// Pas de session utilisateur : l'app est partagée via la clé anon
export const supabase = createClient(supabaseUrl ?? 'http://localhost', supabaseAnonKey ?? 'missing', {
  auth: { persistSession: false, autoRefreshToken: false },
})

export function functionUrl(name: string): string {
  return `${supabaseUrl}/functions/v1/${name}`
}

export const functionHeaders = (): Record<string, string> => ({
  apikey: supabaseAnonKey ?? '',
  Authorization: `Bearer ${supabaseAnonKey ?? ''}`,
})
