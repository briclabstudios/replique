import { functionHeaders, functionUrl } from '../supabase'

/** Extrait l'identifiant d'un lien Google Docs (…/document/d/<id>/edit). */
export function googleDocId(url: string): string | null {
  const m = /\/document\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]{20,})/.exec(url.trim())
  return m ? m[1] : null
}

/** Télécharge l'export HTML du document (via la fonction edge, ou le proxy Vite en développement). */
export async function fetchGoogleDocHtml(docId: string): Promise<string> {
  const res = import.meta.env.DEV
    ? await fetch(`/gdoc-proxy/document/d/${docId}/export?format=html`)
    : await fetch(`${functionUrl('fetch-gdoc')}?id=${encodeURIComponent(docId)}`, { headers: functionHeaders() })

  const contentType = res.headers.get('content-type') ?? ''
  if (!res.ok || !contentType.includes('text/html')) {
    let message = 'Impossible de récupérer le document.'
    try {
      message = (await res.json()).error ?? message
    } catch {
      // réponse non JSON
    }
    throw new Error(`${message} Vérifiez qu’il est partagé à « Tous les utilisateurs disposant du lien ».`)
  }
  const html = await res.text()
  if (html.includes('accounts.google.com/ServiceLogin') || html.includes('id="identifierId"')) {
    throw new Error('Document privé : partagez-le à « Tous les utilisateurs disposant du lien ».')
  }
  return html
}
