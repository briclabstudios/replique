// Synthèse vocale OpenAI : la clé reste côté serveur (secret OPENAI_API_KEY).
// Déploiement : supabase secrets set OPENAI_API_KEY=sk-... && supabase functions deploy tts

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const VOICES = new Set([
  'alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer', 'verse', 'marin', 'cedar',
])
const MAX_CHARS = 4000

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405)

  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) return json({ error: 'OPENAI_API_KEY non configurée sur Supabase' }, 500)

  const { text, voice, instructions, model } = await req.json().catch(() => ({}))
  if (typeof text !== 'string' || !text.trim()) return json({ error: 'Texte manquant' }, 400)
  if (text.length > MAX_CHARS) return json({ error: 'Texte trop long' }, 400)

  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: typeof model === 'string' && model ? model : 'gpt-4o-mini-tts',
      voice: VOICES.has(voice) ? voice : 'alloy',
      input: text,
      instructions: typeof instructions === 'string' ? instructions.slice(0, 1000) : undefined,
      response_format: 'mp3',
    }),
  })

  if (!res.ok) {
    return json({ error: `OpenAI : ${res.status} ${await res.text()}` }, 502)
  }

  return new Response(res.body, {
    headers: { 'Content-Type': 'audio/mpeg', ...CORS_HEADERS },
  })
})
