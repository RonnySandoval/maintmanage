import { useState } from 'react'
import { splitErrorMessage } from '../lib/errorDetail'

/**
 * Muestra un mensaje de error dejando a la vista solo la parte legible y
 * escondiendo el detalle técnico (para programadores) tras un botón "Ver más".
 * Se renderiza como fragmento pensado para colocarse dentro de un `<p>` o `<div>`
 * existente, respetando su estilo.
 */
export function ErrorDetail({ message }: { message: string }) {
  const [open, setOpen] = useState(false)
  const { friendly, technical } = splitErrorMessage(message)

  if (!technical) return <>{friendly}</>

  return (
    <>
      {friendly}
      <button
        type="button"
        className="error-detail-toggle"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        {open ? 'Ver menos' : 'Ver más'}
      </button>
      {open ? <span className="error-detail-tech">{technical}</span> : null}
    </>
  )
}