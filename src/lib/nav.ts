import type { NavigateFunction } from 'react-router-dom'

/** Ruta padre lógica cuando no hay historial interno (enlace directo o recarga). */
export function parentPath(pathname: string): string | null {
  const path = pathname.replace(/\/$/, '') || '/'
  const editar = path.match(/^\/fichas\/([^/]+)\/editar$/)
  if (editar) return `/fichas/${editar[1]}`
  if (path === '/fichas/nueva') return '/fichas'
  if (path === '/inspecciones/nueva') return '/cronograma'
  if (/^\/fichas\/[^/]+$/.test(path)) return '/fichas'
  if (/^\/ocurrencias\/[^/]+$/.test(path)) return '/cronograma'
  return null
}

export function locationKey(pathname: string, search: string): string {
  return `${pathname}${search}`
}

export function goBackOrFallback(navigate: NavigateFunction, fallback: string) {
  const idx = (window.history.state as { idx?: number } | null)?.idx
  if (typeof idx === 'number' && idx > 0) {
    navigate(-1)
    return
  }
  navigate(fallback, { replace: true })
}
