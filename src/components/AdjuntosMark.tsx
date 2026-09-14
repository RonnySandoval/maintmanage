import { Paperclip } from 'lucide-react'

/** Indicador minimalista: solo se muestra si hay al menos un adjunto. */
export function AdjuntosMark({
  count,
  className,
}: {
  count: number
  className?: string
}) {
  if (count < 1) return null
  const label = count === 1 ? '1 archivo adjunto' : `${count} archivos adjuntos`
  return (
    <span
      className={`adjuntos-mark${className ? ` ${className}` : ''}`}
      title={label}
      aria-label={label}
    >
      <Paperclip size={13} strokeWidth={2.25} aria-hidden />
      <span>{count}</span>
    </span>
  )
}
