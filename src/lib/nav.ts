import type { NavigateFunction } from 'react-router-dom'

export function isDashboard(pathname: string): boolean {
  const path = pathname.replace(/\/$/, '') || '/'
  return path === '/'
}

/** Ruta padre lógica cuando no hay historial interno (enlace directo o recarga). */
export function parentPath(pathname: string): string | null {
  const path = pathname.replace(/\/$/, '') || '/'
  if (isDashboard(path)) return null
  const editar = path.match(/^\/fichas\/([^/]+)\/editar$/)
  if (editar) return `/fichas/${editar[1]}`
  if (path === '/fichas/nueva') return '/fichas'
  if (path === '/inspecciones/nueva') return '/cronograma'
  const actEditar = path.match(/^\/actividades\/([^/]+)\/editar$/)
  if (actEditar) return `/actividades/${actEditar[1]}`
  if (path === '/actividades/nueva') return '/fichas?tab=actividades'
  if (/^\/actividades\/[^/]+$/.test(path)) return '/fichas?tab=actividades'
  if (/^\/fichas\/[^/]+$/.test(path)) return '/fichas'
  if (/^\/ocurrencias\/[^/]+$/.test(path)) return '/cronograma'
  if (/^\/eventos\/[^/]+$/.test(path)) return '/cronograma'
  if (/^\/acciones\/[^/]+$/.test(path)) return '/historicos'
  return '/'
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
