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

/** Les derniers mots de la réplique ont-ils été prononcés ? */
export function endReached(expected: string, heard: string, tail = 2): boolean {
  const e = words(expected).slice(-tail)
  const h = words(heard).slice(-tail - 3)
  return e.length > 0 && e.every((w) => h.includes(w))
}
