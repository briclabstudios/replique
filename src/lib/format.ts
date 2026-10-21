export function toRoman(n: number): string {
  const table: [number, string][] = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ]
  let out = ''
  for (const [value, symbol] of table) {
    while (n >= value) {
      out += symbol
      n -= value
    }
  }
  return out
}

export function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return `${n} ${n > 1 ? pluralForm : singular}`
}

/** Couleur stable par personnage, pour les reconnaître d'un coup d'œil. */
export function characterColor(position: number): string {
  return `hsl(${(position * 137) % 360} 55% 42%)`
}
