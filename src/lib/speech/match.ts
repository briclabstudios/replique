// Comparaison entre la réplique attendue et ce que la reconnaissance vocale a entendu.

export function words(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, ' ')
    .replace(/[^a-z0-9œæ\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter(Boolean)
}

/** Longueur de la plus longue sous-séquence commune. */
function lcs(a: string[], b: string[]): number {
  let prev = new Array(b.length + 1).fill(0)
  for (let i = 1; i <= a.length; i++) {
    const cur = new Array(b.length + 1).fill(0)
    for (let j = 1; j <= b.length; j++) {
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1])
    }
    prev = cur
  }
  return prev[b.length]
}

/** Part (0 à 1) des mots attendus entendus dans le bon ordre. */
export function coverage(expected: string, heard: string): number {
  const e = words(expected)
  if (e.length === 0) return 1
  return lcs(e, words(heard)) / e.length
}

/**
 * Détecteur d'écho d'une réplique lue par la synthèse vocale : sur téléphone, le micro capte le
 * haut-parleur, et l'on reconnaît alors surtout les mots de cette réplique, dans l'ordre.
 * Un mot isolé n'est jamais considéré comme un écho. Les mots de la réplique sont préparés une
 * fois, et le verdict de chaque morceau mémorisé : appelé à chaque mot reconnu, il reste léger.
 */
export function echoDetector(spoken: string): (heard: string) => boolean {
  const s = words(spoken)
  const verdicts = new Map<string, boolean>()
  return (heard) => {
    let echo = verdicts.get(heard)
    if (echo === undefined) {
      const h = words(heard)
      echo = h.length >= 2 && lcs(h, s) / h.length >= 0.7
      verdicts.set(heard, echo)
    }
    return echo
  }
}

/**
 * Fusionne les morceaux reconnus qui se répètent. Chrome sur Android reprend souvent le début
 * de la phrase dans chaque nouveau résultat (« je ne » puis « je ne puis ») : on ne garde que
 * le plus complet. Les répétitions exactes ou plus courtes sont écartées.
 */
export function mergeRepeats(segments: string[]): string[] {
  const kept: string[] = []
  let lastWords = ''
  for (const segment of segments) {
    const w = words(segment).join(' ')
    if (!w) continue
    if (lastWords && (w === lastWords || lastWords.startsWith(`${w} `))) continue
    if (lastWords && w.startsWith(`${lastWords} `)) kept[kept.length - 1] = segment
    else kept.push(segment)
    lastWords = w
  }
  return kept
}

/** Les derniers mots de la réplique ont-ils été prononcés ? */
export function endReached(expected: string, heard: string, tail = 2): boolean {
  const e = words(expected).slice(-tail)
  const h = words(heard).slice(-tail - 3)
  return e.length > 0 && e.every((w) => h.includes(w))
}
