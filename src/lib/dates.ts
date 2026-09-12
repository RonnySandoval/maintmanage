import type { EstadoOcurrencia, FechaPrecision, Frecuencia } from '../db/types'
import { mesesDeFrecuencia } from '../db/types'

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function todayISO(): string {
  return toISODate(new Date())
}

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function normalizeISODate(value: string): string {
  if (/^\d{4}-\d{2}$/.test(value)) return `${value}-01`
  return value
}

export function monthValue(iso: string): string {
  return normalizeISODate(iso).slice(0, 7)
}

export function parseISODate(iso: string): Date {
  const normalized = normalizeISODate(iso)
  const [y, m, d] = normalized.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso)
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

export function addMonths(iso: string, months: number): string {
  const normalized = normalizeISODate(iso)
  const [y, m, d] = normalized.split('-').map(Number)
  const date = new Date(y, (m ?? 1) - 1 + months, 1)
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  date.setDate(Math.min(d ?? 1, lastDay))
  return toISODate(date)
}

export function lastDayOfMonth(iso: string): string {
  const normalized = normalizeISODate(iso)
  const [y, m] = normalized.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return `${y}-${pad(m)}-${pad(last)}`
}

export function dueDate(iso: string, precision: FechaPrecision = 'dia'): string {
  const normalized = normalizeISODate(iso)
  return precision === 'mes' ? lastDayOfMonth(normalized) : normalized
}

export function maxISO(a: string, b: string): string {
  return a >= b ? a : b
}

export function formatDate(iso: string): string {
  return parseISODate(iso).toLocaleDateString('es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateLong(iso: string): string {
  return parseISODate(iso).toLocaleDateString('es', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function formatFechaProgramada(iso: string, precision: FechaPrecision = 'dia'): string {
  if (precision === 'mes') return monthLabel(iso)
  return formatDate(iso)
}

export function weekdayShort(iso: string): string {
  return parseISODate(iso).toLocaleDateString('es', { weekday: 'short' })
}

export function monthLabel(iso: string): string {
  const d = parseISODate(`${monthValue(iso)}-01`)
  return d.toLocaleDateString('es', { month: 'long', year: 'numeric' })
}

export function monthShort(iso: string): string {
  return parseISODate(`${monthValue(iso)}-01`).toLocaleDateString('es', { month: 'short' })
}

export function currentMonthPrefix(): string {
  return todayISO().slice(0, 7)
}

export function quarterIndex(month: number): number {
  return Math.floor(month / 3)
}

export function quarterLabel(date = new Date(), trimestreWord = 'trimestre'): string {
  const word = trimestreWord.trim() || 'trimestre'
  const labels = [`Primer ${word}`, `Segundo ${word}`, `Tercer ${word}`, `Cuarto ${word}`]
  return `${labels[quarterIndex(date.getMonth())]} ${date.getFullYear()}`
}

export function toDatetimeLocalValue(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function inCurrentQuarter(iso: string, date = new Date()): boolean {
  const scheduled = parseISODate(iso)
  if (scheduled.getFullYear() !== date.getFullYear()) return false
  return quarterIndex(scheduled.getMonth()) === quarterIndex(date.getMonth())
}

export function nextDate(iso: string, freq: Frecuencia | string): string {
  const meses = mesesDeFrecuencia(freq)
  if (freq === 'unica') return iso
  if (freq === 'semanal') return addDays(iso, 7)
  if (meses <= 0) return iso
  return addMonths(iso, meses)
}

export function generateDates(
  start: string,
  freq: Frecuencia | string,
  horizonMonths = 12,
): string[] {
  const origin = normalizeISODate(start)
  if (freq === 'unica') return [origin]
  const until = addMonths(maxISO(origin, todayISO()), horizonMonths)
  const dates: string[] = []
  let cursor = origin
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
  today: string,
  ejecutada: boolean,
  _precision: FechaPrecision = 'dia',
): EstadoOcurrencia {
  if (ejecutada) return 'ejecutada'
  const due = dueDate(fechaProgramada, _precision)
  if (due < today) return 'vencida'
  if (monthValue(today) === monthValue(fechaProgramada)) return 'pendiente'
  const scheduled = parseISODate(fechaProgramada)
  const now = parseISODate(today)
  if (
    scheduled.getFullYear() === now.getFullYear() &&
    quarterIndex(scheduled.getMonth()) === quarterIndex(now.getMonth())
  ) {
    return 'proxima'
  }
  return 'planificada'
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** true si `fecha` es esta o posterior a `desde` (por mes o por día). */
export function fechaEnAdelante(
  fecha: string,
  desde: string,
  precision: FechaPrecision = 'dia',
): boolean {
  if (precision === 'mes') return monthValue(fecha) >= monthValue(desde)
  return normalizeISODate(fecha) >= normalizeISODate(desde)
}

export function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString('es', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}
