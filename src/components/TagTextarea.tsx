import { forwardRef, useRef } from 'react'
import { FICHA_MESSAGE_TAGS } from '../lib/messageTemplates'

const TAG_RE = /\{\{[a-zA-Z_0-9]+\}\}/g
const KNOWN_TAGS = new Set<string>(FICHA_MESSAGE_TAGS.map((t) => t.token))

interface Part {
  text: string
  tag: boolean
  known: boolean
}

function splitParts(value: string): Part[] {
  const parts: Part[] = []
  let last = 0
  for (const match of value.matchAll(TAG_RE)) {
    const index = match.index ?? 0
    if (index > last) parts.push({ text: value.slice(last, index), tag: false, known: false })
    const token = match[0]
    parts.push({ text: token, tag: true, known: KNOWN_TAGS.has(token) })
    last = index + token.length
  }
  if (last < value.length) parts.push({ text: value.slice(last), tag: false, known: false })
  return parts
}

/**
 * Editor de plantilla: por fuera es un textarea normal (cursor, selección,
 * insertar en la posición del cursor), por dentro dibuja las {{etiquetas}}
 * como píldoras con borde y color propio.
 */
export const TagTextarea = forwardRef<
  HTMLTextAreaElement,
  {
    id: string
    value: string
    onChange: (value: string) => void
    placeholder?: string
    rows?: number
  }
>(function TagTextarea({ id, value, onChange, placeholder, rows = 5 }, ref) {
  const backdropRef = useRef<HTMLDivElement>(null)
  const parts = splitParts(value)

  function syncScroll(event: React.UIEvent<HTMLTextAreaElement>) {
    const backdrop = backdropRef.current
    if (!backdrop) return
    backdrop.scrollTop = event.currentTarget.scrollTop
    backdrop.scrollLeft = event.currentTarget.scrollLeft
  }

  return (
    <div className="tag-editor">
      <div className="tag-editor-backdrop" aria-hidden ref={backdropRef}>
        <pre>
          {parts.map((part, i) =>
            part.tag ? (
              <span key={i} className={`tag-token${part.known ? '' : ' unknown'}`}>
                {part.text}
              </span>
            ) : (
              <span key={i}>{part.text}</span>
            ),
          )}
          {/* El <pre> colapsa el salto final; el espacio conserva la altura. */}
          {value.endsWith('\n') ? ' ' : null}
        </pre>
      </div>
      <textarea
        ref={ref}
        id={id}
        className="textarea tag-editor-input"
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onScroll={syncScroll}
        spellCheck={false}
      />
    </div>
  )
})
