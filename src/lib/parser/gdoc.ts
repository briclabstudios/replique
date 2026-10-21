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

  const sharingHint = 'Vérifiez qu’il est partagé à « Tous les utilisateurs disposant du lien ».'
  if (!res.ok) {
    let message = `Impossible de récupérer le document. ${sharingHint}`
    try {
      message = (await res.json()).error ?? message
    } catch {
      // réponse non JSON
    }
    throw new Error(message)
  }
  // Pas de contrôle du Content-Type : Supabase sert les réponses HTML des fonctions en text/plain
  const html = await res.text()
  if (!/<html[\s>]/i.test(html)) throw new Error(`Réponse inattendue : ce n’est pas un document Google Docs. ${sharingHint}`)
  if (html.includes('accounts.google.com/ServiceLogin') || html.includes('id="identifierId"')) {
    throw new Error('Document privé : partagez-le à « Tous les utilisateurs disposant du lien ».')
  }
  return html
}
