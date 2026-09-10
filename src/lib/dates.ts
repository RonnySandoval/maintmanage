import type { EstadoOcurrencia, Frecuencia } from '../db/types'

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function todayISO(): string {
  const n = new Date()
  return toISODate(n)
}

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso)
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, (m ?? 1) - 1 + months, 1)
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  date.setDate(Math.min(d ?? 1, lastDay))
  return toISODate(date)
}

export function maxISO(a: string, b: string): string {
  return a >= b ? a : b
}

export function formatDate(iso: string): string {
  const d = parseISODate(iso)
  return d.toLocaleDateString('es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateLong(iso: string): string {
  const d = parseISODate(iso)
  return d.toLocaleDateString('es', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function weekdayShort(iso: string): string {
  return parseISODate(iso).toLocaleDateString('es', { weekday: 'short' })
}

export function monthLabel(iso: string): string {
  const d = parseISODate(`${iso.slice(0, 7)}-01`)
  return d.toLocaleDateString('es', { month: 'long', year: 'numeric' })
}

export function currentMonthPrefix(): string {
  return todayISO().slice(0, 7)
}

export function nextDate(iso: string, freq: Frecuencia): string {
  switch (freq) {
    case 'semanal':
      return addDays(iso, 7)
    case 'mensual':
      return addMonths(iso, 1)
    case 'trimestral':
      return addMonths(iso, 3)
    case 'anual':
      return addMonths(iso, 12)
    default:
      return iso
  }
}

export function generateDates(
  start: string,
  freq: Frecuencia,
  horizonMonths = 12,
): string[] {
  if (freq === 'unica') return [start]
  const until = addMonths(maxISO(start, todayISO()), horizonMonths)
  const dates: string[] = []
  let cursor = start
  while (cursor <= until) {
    dates.push(cursor)
    const next = nextDate(cursor, freq)
    if (next <= cursor) break
    cursor = next
    if (dates.length > 200) break
  }
  return dates
}

export function computeEstado(
  fechaProgramada: string,
  umbralDias: number,
  today: string,
  ejecutada: boolean,
): EstadoOcurrencia {
  if (ejecutada) return 'ejecutada'
  if (fechaProgramada < today) return 'vencida'
  const limite = addDays(today, umbralDias)
  if (fechaProgramada <= limite) return 'proxima'
  return 'pendiente'
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
