import { useEffect, useState, type TransitionEvent } from 'react'

const EXIT_MS = 280

/** Monta el overlay y anima entrada/salida con la clase `is-open`. */
export function useOverlayPresence(open: boolean) {
  const [mounted, setMounted] = useState(open)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (open) {
      setMounted(true)
      const id = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setShown(true))
      })
      return () => window.cancelAnimationFrame(id)
    }

    setShown(false)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      setMounted(false)
      return
    }
    const t = window.setTimeout(() => setMounted(false), EXIT_MS)
    return () => window.clearTimeout(t)
  }, [open])

  function onTransitionEnd(e: TransitionEvent<HTMLElement>) {
    if (e.target !== e.currentTarget) return
    if (!open) setMounted(false)
  }

  return { mounted, shown, onTransitionEnd }
}
