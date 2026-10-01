import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

interface SwipeOpts {
  /** Distance in px required to register a swipe. */
  threshold?: number
  /** Only allow swipe when this filter returns true (e.g. not on form pages). */
  enabled?: boolean
}

const PANES = ['/', '/cronograma', '/fichas', '/historicos', '/notas', '/ajustes']

const THRESHOLD = 48

function normalizePath(pathname: string): string {
  for (const pane of PANES) {
    if (pathname === pane) return pane
    if (pathname.startsWith(pane + '/')) return pane
  }
  return ''
}

export function useSwipeNavigation(
  containerRef: React.RefObject<HTMLElement | null>,
  opts: SwipeOpts = {},
) {
  const { threshold = THRESHOLD, enabled = true } = opts
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const el = containerRef.current
    if (!el || !enabled) return

    let startX = 0
    let startY = 0
    let startTime = 0
    let activeTouch: Touch | null = null

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length !== 1) return
      activeTouch = e.touches[0]
      startX = activeTouch.clientX
      startY = activeTouch.clientY
      startTime = Date.now()
    }

    function onTouchMove(e: TouchEvent) {
      if (!activeTouch) return
      const t = e.touches[0]
      if (t.identifier !== activeTouch.identifier) return
      const dx = Math.abs(t.clientX - startX)
      const dy = Math.abs(t.clientY - startY)
      if (dx > 10 && dx > dy) {
        e.preventDefault()
      }
    }

    function onTouchEnd(e: TouchEvent) {
      if (!activeTouch) return
      const elapsed = Date.now() - startTime
      const touch = Array.from(e.changedTouches).find((t) => t.identifier === activeTouch!.identifier)
      if (!touch) {
        activeTouch = null
        return
      }
      const dx = touch.clientX - startX
      const dy = touch.clientY - startY
      const absDx = Math.abs(dx)
      const absDy = Math.abs(dy)

      if (elapsed < 500 && absDx > threshold && absDx > absDy * 1.5) {
        const current = normalizePath(location.pathname)
        const idx = PANES.indexOf(current)
        if (idx === -1) return
        if (dx < 0 && idx < PANES.length - 1) {
          navigate(PANES[idx + 1], { replace: true })
        } else if (dx > 0 && idx > 0) {
          navigate(PANES[idx - 1], { replace: true })
        }
      }
      activeTouch = null
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [containerRef, enabled, threshold, location.pathname, navigate])
}
