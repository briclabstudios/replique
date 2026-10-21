// Récupère l'export HTML d'un Google Doc partagé « Tous les utilisateurs disposant du lien ».
// Le navigateur ne peut pas le faire directement (CORS) ; l'italique est conservé dans l'export HTML.

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

// Seuls des identifiants de document sont acceptés : la fonction ne peut pas servir de proxy ouvert
const DOC_ID = /^[a-zA-Z0-9_-]{20,}$/

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

  const docId = new URL(req.url).searchParams.get('id') ?? ''
  if (!DOC_ID.test(docId)) return json({ error: 'Identifiant de document invalide' }, 400)

  const res = await fetch(`https://docs.google.com/document/d/${docId}/export?format=html`, {
    redirect: 'follow',
  })
  const contentType = res.headers.get('content-type') ?? ''
  if (!res.ok || !contentType.includes('text/html')) {
    return json({ error: 'Document inaccessible. Vérifiez qu’il est partagé à « Tous les utilisateurs disposant du lien ».' }, 404)
  }

  const html = await res.text()
  // Une page de connexion Google signifie que le document n'est pas public
  if (html.includes('accounts.google.com/ServiceLogin') || html.includes('id="identifierId"')) {
    return json({ error: 'Document privé. Partagez-le à « Tous les utilisateurs disposant du lien ».' }, 403)
  }

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', ...CORS_HEADERS },
  })
})
