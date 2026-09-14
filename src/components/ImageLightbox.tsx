import { useEffect, type MouseEvent } from 'react'
import { X } from 'lucide-react'
import { ShareMenu } from './ShareMenu'

/** Vista ampliada a pantalla casi completa; encabezado + pie + compartir. */
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
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  function stop(e: MouseEvent) {
    e.stopPropagation()
  }

  const canShare = Boolean(shareTitle && shareText)

  return (
    <div
      className="image-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={alt || header || 'Imagen'}
      onClick={onClose}
    >
      <header className="image-lightbox-top" onClick={stop}>
        <div className="image-lightbox-header">
          {header ? <p className="image-lightbox-heading">{header}</p> : <span />}
        </div>
        <div className="image-lightbox-actions">
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
      <img className="image-lightbox-img" src={src} alt={alt} onClick={stop} />
      {alt ? (
        <p className="image-lightbox-caption" onClick={stop}>
          {alt}
        </p>
      ) : null}
    </div>
  )
}
