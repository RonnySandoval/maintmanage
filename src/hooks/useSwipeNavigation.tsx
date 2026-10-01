import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

const PANES = ['/', '/cronograma', '/fichas', '/historicos', '/notas', '/ajustes']
const THRESHOLD = 48
const DURATION = 280

function findRouteIndex(pathname: string): number {
  for (let i = 0; i < PANES.length; i++) {
    if (pathname === PANES[i] || pathname.startsWith(PANES[i] + '/')) return i
  }
  return -1
}

export function useSwipeNavigation(
  containerRef: React.RefObject<HTMLElement | null>,
  opts: { enabled?: boolean } = {},
) {
  const { enabled = true } = opts
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const el = containerRef.current
    if (!el || !enabled) return

    const clearStyle = () => {
      el.style.transition = ''
      el.style.transform = ''
      el.style.opacity = ''
    }

    let startX = 0
    let startY = 0
    let startTime = 0

    function finishAnimation() {
      if (!el) return
      clearStyle()
    }

    function enterNew(direction: 'forward' | 'backward') {
      if (!el) return
      el.style.transition = 'none'
      el.style.opacity = '0'
      el.style.transform = direction === 'forward' ? 'translateX(24px)' : 'translateX(-24px)'
      void el.offsetWidth
      el.style.transition = `transform ${DURATION}ms ease-out, opacity ${DURATION}ms ease-out`
      el.style.opacity = '1'
      el.style.transform = ''
      setTimeout(finishAnimation, DURATION)
    }

    function onTouchStart(e: TouchEvent) {
      if (!el) return
      if (e.touches.length !== 1) return
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
      startTime = Date.now()
      el.style.transition = 'none'
    }

    function onTouchMove(e: TouchEvent) {
      if (!el || startTime === 0) return
      const dx = e.touches[0].clientX - startX
      const dy = e.touches[0].clientY - startY
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
        e.preventDefault()
        el.style.transform = `translateX(${dx}px)`
      }
    }

    function onTouchEnd(e: TouchEvent) {
      if (!el || startTime === 0) return
      const touch = e.changedTouches[0]
      const dx = touch.clientX - startX
      const dy = touch.clientY - startY
      const elapsed = Date.now() - startTime
      startTime = 0

      const absDx = Math.abs(dx)
      const absDy = Math.abs(dy)
      const isHorizontal = absDx > absDy * 1.5
      const committed = elapsed < 500 && absDx > THRESHOLD && isHorizontal

      if (committed) {
        const currentIdx = findRouteIndex(location.pathname)
        if (currentIdx === -1) {
          finishAnimation()
          return
        }

        let targetIdx = currentIdx
        if (dx < 0 && currentIdx < PANES.length - 1) targetIdx = currentIdx + 1
        else if (dx > 0 && currentIdx > 0) targetIdx = currentIdx - 1

        if (targetIdx === currentIdx) {
          finishAnimation()
          return
        }

        const direction: 'forward' | 'backward' = targetIdx > currentIdx ? 'forward' : 'backward'
        const slideOut = direction === 'forward' ? '-100%' : '100%'

        el.style.transition = `transform ${DURATION}ms cubic-bezier(0.2, 0, 0, 1)`
        el.style.transform = `translateX(${slideOut})`

        setTimeout(() => {
          navigate(PANES[targetIdx], { replace: true })
          setTimeout(() => enterNew(direction), 50)
        }, DURATION)
      } else {
        el.style.transition = `transform ${DURATION}ms cubic-bezier(0.2, 0, 0, 1)`
        el.style.transform = ''
        setTimeout(finishAnimation, DURATION)
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })

    return () => {
      if (!el) return
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [containerRef, enabled, location.pathname, navigate])
}
