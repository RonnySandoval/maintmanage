import { useEffect, useRef, useState, type MouseEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { X, ZoomIn, ZoomOut } from 'lucide-react'
import { ShareMenu } from './ShareMenu'

const MIN_SCALE = 1
const MAX_SCALE = 4
const ZOOM_STEP = 0.35
const DOUBLE_TAP_MS = 280

type Point = { x: number; y: number }

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function distance(a: Point, b: Point) {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.hypot(dx, dy)
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

/** Vista ampliada a pantalla casi completa; encabezado + pie + compartir + zoom. */
export function ImageLightbox({
  src,
  alt = '',
  header = '',
  shareTitle,
  shareText,
  shareFiles,
  onClose,
}: {
  src: string
  alt?: string
  /** Fecha · ficha/actividad */
  header?: string
  shareTitle?: string
  shareText?: string
  shareFiles?: File[]
  onClose: () => void
}) {
  const stageRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [tx, setTx] = useState(0)
  const [ty, setTy] = useState(0)
  const scaleRef = useRef(1)
  const txRef = useRef(0)
  const tyRef = useRef(0)
  const pointers = useRef(new Map<number, Point>())
  const pinchStart = useRef<{ dist: number; scale: number; mid: Point; tx: number; ty: number } | null>(
    null,
  )
  const dragStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null)
  const moved = useRef(false)
  const [smooth, setSmooth] = useState(true)
  const lastTap = useRef(0)

  scaleRef.current = scale
  txRef.current = tx
  tyRef.current = ty

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (scaleRef.current > 1.01) {
          resetZoom()
          return
        }
        onClose()
      }
      if (e.key === '+' || e.key === '=') zoomBy(ZOOM_STEP)
      if (e.key === '-' || e.key === '_') zoomBy(-ZOOM_STEP)
      if (e.key === '0') resetZoom()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    function onWheel(e: WheelEvent) {
      e.preventDefault()
      e.stopPropagation()
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
      zoomAt(e.clientX, e.clientY, scaleRef.current + delta, false)
    }
    stage.addEventListener('wheel', onWheel, { passive: false })
    return () => stage.removeEventListener('wheel', onWheel)
  }, [])

  function stop(e: MouseEvent) {
    e.stopPropagation()
  }

  function setTransform(nextScale: number, nextTx: number, nextTy: number, withSmooth = false) {
    const s = clamp(nextScale, MIN_SCALE, MAX_SCALE)
    const stage = stageRef.current
    setSmooth(withSmooth)
    if (!stage || s <= 1.001) {
      setScale(1)
      setTx(0)
      setTy(0)
      return
    }
    const maxX = (stage.clientWidth * (s - 1)) / 2
    const maxY = (stage.clientHeight * (s - 1)) / 2
    setScale(s)
    setTx(clamp(nextTx, -maxX, maxX))
    setTy(clamp(nextTy, -maxY, maxY))
  }

  function resetZoom() {
    setSmooth(true)
    setScale(1)
    setTx(0)
    setTy(0)
  }

  function zoomAt(clientX: number, clientY: number, nextScale: number, withSmooth = true) {
    const stage = stageRef.current
    if (!stage) return
    const rect = stage.getBoundingClientRect()
    const cx = clientX - rect.left - rect.width / 2
    const cy = clientY - rect.top - rect.height / 2
    const prev = scaleRef.current
    const s = clamp(nextScale, MIN_SCALE, MAX_SCALE)
    if (s <= 1.001) {
      resetZoom()
      return
    }
    const ratio = s / prev
    setTransform(s, cx - (cx - txRef.current) * ratio, cy - (cy - tyRef.current) * ratio, withSmooth)
  }

  function zoomBy(delta: number) {
    const stage = stageRef.current
    if (!stage) return
    const rect = stage.getBoundingClientRect()
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, scaleRef.current + delta)
  }

  function toggleZoomAt(clientX: number, clientY: number) {
    if (scaleRef.current > 1.05) resetZoom()
    else zoomAt(clientX, clientY, 2.2)
  }

  function onPointerDown(e: ReactPointerEvent) {
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    moved.current = false

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinchStart.current = {
        dist: distance(a, b),
        scale: scaleRef.current,
        mid: midpoint(a, b),
        tx: txRef.current,
        ty: tyRef.current,
      }
      dragStart.current = null
      return
    }

    if (scaleRef.current > 1.01) {
      dragStart.current = {
        x: e.clientX,
        y: e.clientY,
        tx: txRef.current,
        ty: tyRef.current,
      }
    }
  }

  function onPointerMove(e: ReactPointerEvent) {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.current.size === 2 && pinchStart.current) {
      const [a, b] = [...pointers.current.values()]
      const dist = distance(a, b)
      const mid = midpoint(a, b)
      const start = pinchStart.current
      if (start.dist < 1) return
      const nextScale = start.scale * (dist / start.dist)
      const stage = stageRef.current
      if (!stage) return
      const rect = stage.getBoundingClientRect()
      const cx = mid.x - rect.left - rect.width / 2
      const cy = mid.y - rect.top - rect.height / 2
      const startCx = start.mid.x - rect.left - rect.width / 2
      const startCy = start.mid.y - rect.top - rect.height / 2
      const ratio = nextScale / start.scale
      setTransform(
        nextScale,
        cx - (startCx - start.tx) * ratio,
        cy - (startCy - start.ty) * ratio,
        false,
      )
      moved.current = true
      return
    }

    if (dragStart.current && scaleRef.current > 1.01) {
      const dx = e.clientX - dragStart.current.x
      const dy = e.clientY - dragStart.current.y
      if (Math.hypot(dx, dy) > 4) moved.current = true
      setTransform(scaleRef.current, dragStart.current.tx + dx, dragStart.current.ty + dy, false)
    }
  }

  function onPointerUp(e: ReactPointerEvent) {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinchStart.current = null
    if (pointers.current.size === 0) {
      const wasDrag = moved.current
      const x = e.clientX
      const y = e.clientY
      dragStart.current = null

      if (!wasDrag && e.pointerType !== 'mouse') {
        const now = Date.now()
        if (now - lastTap.current < DOUBLE_TAP_MS) {
          toggleZoomAt(x, y)
          lastTap.current = 0
        } else {
          lastTap.current = now
        }
      } else if (!wasDrag && e.pointerType === 'mouse' && e.button === 0) {
        // Click simple en desktop: no toggle; double-click sí.
      }
    }
  }

  function onDoubleClick(e: MouseEvent) {
    e.stopPropagation()
    toggleZoomAt(e.clientX, e.clientY)
  }

  const canShare = Boolean(shareTitle && shareText)
  const zoomed = scale > 1.01

  return (
    <div
      className={`image-lightbox${zoomed ? ' is-zoomed' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={alt || header || 'Imagen'}
      onClick={() => {
        if (zoomed) resetZoom()
        else onClose()
      }}
    >
      <header className="image-lightbox-top" onClick={stop}>
        <div className="image-lightbox-header">
          {header ? <p className="image-lightbox-heading">{header}</p> : <span />}
        </div>
        <div className="image-lightbox-actions">
          <button
            type="button"
            className="image-lightbox-zoom"
            onClick={() => zoomBy(-ZOOM_STEP)}
            aria-label="Alejar"
            title="Alejar"
            disabled={scale <= MIN_SCALE + 0.01}
          >
            <ZoomOut size={18} />
          </button>
          <button
            type="button"
            className="image-lightbox-zoom"
            onClick={() => zoomBy(ZOOM_STEP)}
            aria-label="Acercar"
            title="Acercar"
            disabled={scale >= MAX_SCALE - 0.01}
          >
            <ZoomIn size={18} />
          </button>
          {canShare ? (
            <ShareMenu
              title={shareTitle!}
              text={shareText!}
              files={shareFiles}
              iconOnly
              className="image-lightbox-share"
            />
          ) : null}
          <button
            type="button"
            className="image-lightbox-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X size={22} />
          </button>
        </div>
      </header>

      <div
        ref={stageRef}
        className="image-lightbox-stage"
        onClick={stop}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
      >
        <img
          className={`image-lightbox-img${smooth ? ' is-smooth' : ''}`}
          src={src}
          alt={alt}
          draggable={false}
          style={{
            transform: `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`,
          }}
        />
      </div>

      {alt || zoomed ? (
        <p className="image-lightbox-caption" onClick={stop}>
          {[alt, zoomed ? `${Math.round(scale * 100)}%` : null].filter(Boolean).join(' · ')}
        </p>
      ) : null}
    </div>
  )
}
