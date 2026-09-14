import { useEffect, useRef, useState } from 'react'
import { ALargeSmall } from 'lucide-react'
import { useFontScale } from '../hooks/useFontScale'
import { FONT_SCALE_MAX, FONT_SCALE_MIN, FONT_SCALE_STEP } from '../lib/fontScale'

export function FontScaleToggle() {
  const { scale, setScale } = useFontScale()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const percent = Math.round(scale * 100)

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="font-scale-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`icon-btn${open ? ' is-active' : ''}`}
        aria-label="Tamaño de letra"
        aria-expanded={open}
        title={`Tamaño de letra (${percent}%)`}
        onClick={() => setOpen((was) => !was)}
      >
        <ALargeSmall size={18} />
      </button>
      {open ? (
        <div className="font-scale-pop" role="dialog" aria-label="Tamaño de letra">
          <span className="font-scale-pop-a" aria-hidden>
            A
          </span>
          <input
            type="range"
            min={FONT_SCALE_MIN}
            max={FONT_SCALE_MAX}
            step={FONT_SCALE_STEP}
            value={scale}
            aria-valuemin={Math.round(FONT_SCALE_MIN * 100)}
            aria-valuemax={Math.round(FONT_SCALE_MAX * 100)}
            aria-valuenow={percent}
            aria-label="Tamaño de letra"
            onChange={(e) => setScale(Number(e.target.value))}
          />
          <span className="font-scale-pop-a is-lg" aria-hidden>
            A
          </span>
          <span className="font-scale-pop-pct">{percent}%</span>
        </div>
      ) : null}
    </div>
  )
}
