import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Check } from 'lucide-react'

const DECADE_SIZE = 12

function decadeStart(year: number): number {
  return Math.floor(year / DECADE_SIZE) * DECADE_SIZE
}

function yearsInDecade(start: number): number[] {
  return Array.from({ length: DECADE_SIZE }, (_, i) => start + i)
}

export function YearSelector({
  year,
  onChange,
}: {
  year: number
  onChange: (year: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [currentDecadeStart, setCurrentDecadeStart] = useState(() => decadeStart(year))
  const btnRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setCurrentDecadeStart(decadeStart(year))
  }, [open, year])

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent | TouchEvent) {
      if (btnRef.current?.contains(e.target as Node) || popoverRef.current?.contains(e.target as Node)) {
        return
      }
      setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const allYears = yearsInDecade(currentDecadeStart)
  const prevStart = currentDecadeStart - DECADE_SIZE
  const nextStart = currentDecadeStart + DECADE_SIZE

  function pick(y: number) {
    onChange(y)
    setOpen(false)
  }

  const today = new Date().getFullYear()

  return (
    <div className="year-selector">
      <button
        type="button"
        ref={btnRef}
        className="year-selector-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Año: ${year}. Haz clic para cambiar.`}
        onClick={() => setOpen((o) => !o)}
      >
        <strong>{year}</strong>
      </button>
      {open ? (
        <div className="year-selector-popover" ref={popoverRef} role="presentation">
          <div className="year-selector-decade-nav">
            <button
              type="button"
              className="year-selector-decade-btn icon-btn"
              aria-label={`Década anterior (${prevStart}–${prevStart + DECADE_SIZE - 1})`}
              onClick={() => setCurrentDecadeStart(prevStart)}
            >
              <ChevronLeft size={14} />
            </button>
            <span className="year-selector-decade-label">
              {currentDecadeStart}–{currentDecadeStart + DECADE_SIZE - 1}
            </span>
            <button
              type="button"
              className="year-selector-decade-btn icon-btn"
              aria-label={`Década siguiente (${nextStart}–${nextStart + DECADE_SIZE - 1})`}
              onClick={() => setCurrentDecadeStart(nextStart)}
            >
              <ChevronRight size={14} />
            </button>
          </div>
          <div className="year-selector-grid" role="listbox">
            {allYears.map((y) => {
              const isCurrent = y === year
              const isToday = y === today
              return (
                <button
                  key={y}
                  type="button"
                  className={`year-selector-year${isCurrent ? ' is-selected' : ''}${
                    isToday && !isCurrent ? ' is-today' : ''
                  }`}
                  role="option"
                  aria-selected={isCurrent}
                  onClick={() => pick(y)}
                >
                  {y}
                  {isCurrent ? <Check size={12} className="year-selector-check" /> : null}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}
