export const BLOQUE_PALETTE = [
  { id: 'teal', label: 'Verde azulado', light: '#0b5c56', dark: '#2dd4bf' },
  { id: 'sky', label: 'Azul', light: '#075985', dark: '#38bdf8' },
  { id: 'indigo', label: 'Índigo', light: '#3730a3', dark: '#818cf8' },
  { id: 'violet', label: 'Violeta', light: '#5b21b6', dark: '#c4b5fd' },
  { id: 'fuchsia', label: 'Fucsia', light: '#86198f', dark: '#e879f9' },
  { id: 'rose', label: 'Rosa', light: '#9f1239', dark: '#fb7185' },
  { id: 'orange', label: 'Naranja', light: '#9a3412', dark: '#fb923c' },
  { id: 'amber', label: 'Ámbar', light: '#92400e', dark: '#fbbf24' },
  { id: 'green', label: 'Verde', light: '#14532d', dark: '#4ade80' },
  { id: 'slate', label: 'Pizarra', light: '#1e293b', dark: '#cbd5e1' },
] as const

export type BloqueColorId = (typeof BLOQUE_PALETTE)[number]['id']

export const DEFAULT_BLOQUE_COLOR: BloqueColorId = 'teal'

const BY_ID = Object.fromEntries(BLOQUE_PALETTE.map((swatch) => [swatch.id, swatch])) as Record<
  BloqueColorId,
  (typeof BLOQUE_PALETTE)[number]
>

export function isBloqueColorId(value: string): value is BloqueColorId {
  return value in BY_ID
}

function parseHex(hex: string): [number, number, number] | null {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim())
  if (!match) return null
  const n = Number.parseInt(match[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function distSq(a: [number, number, number], b: [number, number, number]): number {
  const dr = a[0] - b[0]
  const dg = a[1] - b[1]
  const db = a[2] - b[2]
  return dr * dr + dg * dg + db * db
}

export function bloqueColorId(stored?: string | null): BloqueColorId {
  if (!stored) return DEFAULT_BLOQUE_COLOR
  const trimmed = stored.trim()
  if (isBloqueColorId(trimmed)) return trimmed
  const fromVar = /^var\(--bloque-([a-z]+)\)$/.exec(trimmed)
  if (fromVar && isBloqueColorId(fromVar[1])) return fromVar[1]
  const rgb = parseHex(trimmed)
  if (!rgb) return DEFAULT_BLOQUE_COLOR
  let best: BloqueColorId = DEFAULT_BLOQUE_COLOR
  let bestDist = Infinity
  for (const swatch of BLOQUE_PALETTE) {
    for (const hex of [swatch.light, swatch.dark]) {
      const other = parseHex(hex)
      if (!other) continue
      const d = distSq(rgb, other)
      if (d < bestDist) {
        bestDist = d
        best = swatch.id
      }
    }
  }
  return best
}

export function bloqueColorVar(stored?: string | null): string {
  return `var(--bloque-${bloqueColorId(stored)})`
}

export const BLOQUE_COLORS = BLOQUE_PALETTE.map((swatch) => swatch.light)
export const GRUPO_COLORS = BLOQUE_COLORS
