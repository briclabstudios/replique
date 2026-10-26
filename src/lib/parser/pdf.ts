// Extraction des paragraphes d'un fichier PDF, sans le texte en italique (didascalies).
import { cleanText, type ExtractedDoc } from './html'

export interface PdfTextItem {
  str: string
  x: number
  y: number
  italic: boolean
}

const LINE_TOLERANCE = 3 // écart vertical (en points) en dessous duquel deux fragments sont sur la même ligne

/** Regroupe les fragments de texte par ligne (haut en bas, gauche à droite) en retirant les italiques. */
export function itemsToParagraphs(items: PdfTextItem[]): string[] {
  const sorted = items.filter((i) => i.str !== '').sort((a, b) => b.y - a.y || a.x - b.x)
  const lines: PdfTextItem[][] = []
  for (const item of sorted) {
    const last = lines[lines.length - 1]
    if (last && Math.abs(last[0].y - item.y) <= LINE_TOLERANCE) last.push(item)
    else lines.push([item])
  }
  const paragraphs: string[] = []
  for (const line of lines) {
    const text = cleanText(
      line
        .sort((a, b) => a.x - b.x)
        .filter((i) => !i.italic)
        .map((i) => i.str)
        .join(''),
    )
    // Numéros de page isolés
    if (text && !/^\d{1,3}$/.test(text)) paragraphs.push(text)
  }
  return paragraphs
}

export async function extractPdfParagraphs(file: File): Promise<ExtractedDoc> {
  const pdfjs = await import('pdfjs-dist')
  const { default: workerSrc } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc

  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  const paragraphs: string[] = []
  const italicFonts = new Map<string, boolean>()

  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n)
    const content = await page.getTextContent()
    await page.getOperatorList() // charge les polices pour connaître leur vrai nom
    const items: PdfTextItem[] = []
    for (const item of content.items) {
      if (!('str' in item)) continue
      let italic = italicFonts.get(item.fontName)
      if (italic === undefined) {
        const font = page.commonObjs.has(item.fontName) ? page.commonObjs.get(item.fontName) : null
        italic = /italic|oblique/i.test(font?.name ?? '') || font?.italic === true
        italicFonts.set(item.fontName, italic)
      }
      items.push({ str: item.str, x: item.transform[4], y: item.transform[5], italic })
    }
    paragraphs.push(...itemsToParagraphs(items))
  }

  const meta = await pdf.getMetadata().catch(() => null)
  const title = (meta?.info as { Title?: string } | undefined)?.Title?.trim() || file.name.replace(/\.pdf$/i, '')
  return { title, paragraphs }
}
