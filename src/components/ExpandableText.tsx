import { useEffect, useState, type ElementType, type MouseEvent } from 'react'

function collapseText(
  text: string,
  maxLines: number,
  maxChars: number,
): { shown: string; clipped: boolean } {
  const normalized = text.replace(/\r\n/g, '\n')
  const lines = normalized.split('\n')
  if (lines.length <= maxLines && normalized.length <= maxChars) {
    return { shown: normalized, clipped: false }
  }

  let shown = lines.slice(0, maxLines).join('\n')
  if (shown.length > maxChars) {
    shown = shown.slice(0, maxChars)
    const cut = shown.lastIndexOf(' ')
    if (cut > maxChars * 0.6) shown = shown.slice(0, cut)
  }
  shown = shown.replace(/\s+$/u, '')
  if (shown.length >= normalized.length) {
    return { shown: normalized, clipped: false }
  }
  return { shown, clipped: true }
}

/** Texto con saltos de línea y “ver más / ver menos” al estilo WhatsApp. */
export function ExpandableText({
  text,
  className,
  maxLines = 3,
  maxChars = 160,
  as: Tag = 'div',
}: {
  text: string
  className?: string
  maxLines?: number
  maxChars?: number
  as?: ElementType
}) {
  const [expanded, setExpanded] = useState(false)
  const value = text.replace(/\r\n/g, '\n')
  const { shown, clipped } = collapseText(value, maxLines, maxChars)

  useEffect(() => {
    setExpanded(false)
  }, [value])

  if (!value) return null

  function onToggle(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault()
    e.stopPropagation()
    setExpanded((was) => !was)
  }

  return (
    <Tag className={`expandable-text${className ? ` ${className}` : ''}`}>
      <span className="expandable-text-body">
        {expanded || !clipped ? value : `${shown}…`}
        {clipped ? (
          <>
            {' '}
            <button type="button" className="expandable-text-toggle" onClick={onToggle}>
              {expanded ? 'ver menos' : 'ver más'}
            </button>
          </>
        ) : null}
      </span>
    </Tag>
  )
}
