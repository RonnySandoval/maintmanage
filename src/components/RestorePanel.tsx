import { useState } from 'react'
import { FolderOpen, Upload } from 'lucide-react'
import {
  canUseFolderBackup,
  hasUserData,
  importBackup,
  pickBackupFolder,
  restoreFromFolder,
} from '../db/backup'
import { ensureHorizon } from '../db/occurrences'
import { clearRestoreSkip } from '../lib/restoreSkip'

export function RestorePanel({
  compact = false,
  embedded = false,
  onRestored,
  onSkip,
}: {
  compact?: boolean
  embedded?: boolean
  onRestored?: () => void
  onSkip?: () => void
}) {
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const folderOk = canUseFolderBackup()

  async function finishRestore(): Promise<void> {
    await ensureHorizon()
    clearRestoreSkip()
    onRestored?.()
  }

  async function confirmIfNeeded(): Promise<boolean> {
    if (!(await hasUserData())) return true
    return confirm('Esto REEMPLAZA todos los datos de este dispositivo por los de la copia. ¿Continuar?')
  }

  async function fromZip(file: File | undefined): Promise<void> {
    if (!file) return
    if (!(await confirmIfNeeded())) return
    setBusy(true)
    setMessage('')
    try {
      await importBackup(file, 'replace')
      await finishRestore()
      setMessage('Datos recuperados. Ya puedes trabajar en este dispositivo.')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'No se pudo restaurar el archivo.')
    } finally {
      setBusy(false)
    }
  }

  async function fromFolder(): Promise<void> {
    if (!(await confirmIfNeeded())) return
    setBusy(true)
    setMessage('')
    try {
      const handle = await pickBackupFolder()
      await restoreFromFolder(handle, 'replace')
      await finishRestore()
      setMessage('Datos recuperados desde la carpeta de copias.')
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setMessage('')
        return
      }
      setMessage(err instanceof Error ? err.message : 'No se pudo leer la carpeta.')
    } finally {
      setBusy(false)
    }
  }

  const body = (
    <>
      {embedded ? null : <h2 className="title-sm">Recuperar datos</h2>}
      <p className="muted">
        Si borraste la app o cambiaste de dispositivo, restaura desde la carpeta de copias o desde
        el ZIP. Todo se hace aquí, sin herramientas extra.
      </p>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        {folderOk ? (
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void fromFolder()}>
            <FolderOpen size={16} />
            Usar carpeta de copias
          </button>
        ) : null}
        <label className={`btn${folderOk ? '' : ' btn-primary'}`}>
          <Upload size={16} />
          Elegir archivo ZIP
          <input
            className="sr-only"
            type="file"
            accept=".zip,application/zip"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              void fromZip(file)
            }}
          />
        </label>
        {onSkip ? (
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={onSkip}>
            Empezar de cero
          </button>
        ) : null}
      </div>
      {message ? <p className="hint" style={{ marginTop: '0.75rem' }}>{message}</p> : null}
    </>
  )

  if (embedded) return <div className="restore-embedded">{body}</div>

  return (
    <section className={`card restore-panel${compact ? ' restore-panel-compact' : ''}`}>
      {body}
    </section>
  )
}
