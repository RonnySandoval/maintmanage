import { formatDateTime } from '../lib/dates'
import type { AutoBackupBarState } from '../hooks/useAutoBackup'
import { Ban, Clock, X } from 'lucide-react'
import { ErrorDetail } from './ErrorDetail'

const STAGE_TEXT: Record<string, string> = {
  collect: 'Recopilando los datos locales…',
  pack: 'Empaquetando la copia…',
  save: 'Guardando la copia…',
}

type Props = {
  bar: AutoBackupBarState
  onPostpone: () => void
  onCancel: () => void
  onClose: () => void
}

/**
 * Aviso de copia automática en segundo plano: una franja pegada bajo el header,
 * a todo lo ancho, sin bordes redondeados ni márgenes (pantalla completa).
 */
export function AutoBackupBar({ bar, onPostpone, onCancel, onClose }: Props) {
  if (bar.kind === 'none') return null

  const tone =
    bar.kind === 'running'
      ? 'is-running'
      : bar.kind === 'done'
        ? 'is-done'
        : bar.kind === 'error'
          ? 'is-error'
          : 'is-warning'

  let text = ''
  if (bar.kind === 'running') {
    text = `Haciendo copia de seguridad en segundo plano: ${STAGE_TEXT[bar.stage] ?? ''}`
  } else if (bar.kind === 'postponed') {
    text = `Copia aplazada. Se hará dentro de 1 hora (${formatDateTime(bar.at)}).`
  } else if (bar.kind === 'cancelled') {
    text = `Copia cancelada. Se volverá a intentar dentro de 1 hora (${formatDateTime(bar.at)}).`
  } else {
    text = bar.message
  }

  return (
    <div className={`auto-backup-bar ${tone}`} role="status">
      {bar.kind === 'error' ? (
        <p className="auto-backup-bar-text">
          <ErrorDetail message={bar.message} />
        </p>
      ) : (
        <p className="auto-backup-bar-text">{text}</p>
      )}
      <div className="auto-backup-bar-actions">
        {bar.kind === 'running' ? (
          <>
            <button
              type="button"
              className="icon-btn"
              aria-label="Aplazar la copia 1 hora"
              title="Aplazar 1 hora"
              onClick={onPostpone}
            >
              <Clock size={18} />
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label="Cancelar la copia"
              title="Cancelar"
              onClick={onCancel}
            >
              <Ban size={18} />
            </button>
          </>
        ) : null}
        {bar.kind !== 'running' ? (
          <button
            type="button"
            className="icon-btn"
            aria-label="Cerrar aviso"
            title="Cerrar"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        ) : null}
      </div>
    </div>
  )
}