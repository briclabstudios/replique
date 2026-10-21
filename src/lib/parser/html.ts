// Extraction des paragraphes d'un export HTML Google Docs, sans le texte en italique (didascalies).

const BLOCK_SELECTOR = 'p, h1, h2, h3, h4, h5, h6, li'

/** Classes CSS de l'export Google Docs qui portent `font-style:italic`. */
function italicClasses(doc: Document): Set<string> {
  const classes = new Set<string>()
  const rule = /\.([\w-]+)\s*\{([^}]*)\}/g
  for (const style of Array.from(doc.querySelectorAll('style'))) {
    const css = style.textContent ?? ''
    for (const m of css.matchAll(rule)) {
      if (/font-style\s*:\s*italic/i.test(m[2])) classes.add(m[1])
    }
  }
  return classes
}

function isItalic(el: Element, italic: Set<string>): boolean {
  const tag = el.tagName.toLowerCase()
  if (tag === 'i' || tag === 'em') return true
  const inline = el.getAttribute('style') ?? ''
  if (/font-style\s*:\s*italic/i.test(inline)) return true
  return Array.from(el.classList).some((c) => italic.has(c))
}

/** Texte non italique d'un bloc ; les `<br>` deviennent des sauts de ligne. */
function blockText(block: Element, italic: Set<string>): string {
  let out = ''
  const walk = (node: Node, inItalic: boolean) => {
    if (node.nodeType === Node.TEXT_NODE) {
      if (!inItalic) out += node.textContent ?? ''
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const el = node as Element
    if (el.tagName.toLowerCase() === 'br') {
      out += '\n'
      return
    }
    const childItalic = inItalic || isItalic(el, italic)
    for (const child of Array.from(el.childNodes)) walk(child, childItalic)
  }
  walk(block, isItalic(block, italic))
  return out
}

/** Nettoie les restes laissés par le retrait des didascalies. */
export function cleanText(text: string): string {
  return text
    .replace(/ /g, ' ')
    .replace(/\(\s*\)|\[\s*\]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ ([,.])/g, '$1')
    .trim()
    .replace(/^[,;]\s*/, '')
}

export interface ExtractedDoc {
  title: string | null
  paragraphs: string[]
}

export function extractParagraphs(html: string): ExtractedDoc {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const italic = italicClasses(doc)
  const blocks = Array.from(doc.body.querySelectorAll(BLOCK_SELECTOR)).filter(
    (el) => !el.parentElement?.closest(BLOCK_SELECTOR),
  )

  const paragraphs: string[] = []
  for (const block of blocks) {
    for (const part of blockText(block, italic).split('\n')) {
      const text = cleanText(part)
      if (text) paragraphs.push(text)
    }
  }

  const title = doc.querySelector('title')?.textContent?.trim() || null
  return { title, paragraphs }
}
