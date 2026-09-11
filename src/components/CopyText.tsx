import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

export function CopyText({
  text,
  label = 'Copiar',
}: {
  text: string
  label?: string
}) {
  const [done, setDone] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const area = document.createElement('textarea')
      area.value = text
      area.setAttribute('readonly', '')
      area.style.position = 'fixed'
      area.style.left = '-9999px'
      document.body.appendChild(area)
      area.select()
      document.execCommand('copy')
      document.body.removeChild(area)
    }
    setDone(true)
    window.setTimeout(() => setDone(false), 1400)
  }

  return (
    <button
      type="button"
      className={`icon-btn icon-btn-copy${done ? ' is-done' : ''}`}
      aria-label={done ? 'Copiado' : label}
      title={done ? 'Copiado' : label}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        void copy()
      }}
    >
      {done ? <Check size={15} /> : <Copy size={15} />}
    </button>
  )
}
