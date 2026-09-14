import { useState } from 'react'
import { FileJson, FolderOpen, Upload } from 'lucide-react'
import {
  BACKUP_FILE_NAME,
  backupKindLabel,
  canUseFolderBackup,
  hasUserData,
  importBackup,
  pickBackupFolder,
  restoreFromFolder,
} from '../db/backup'
import { ensureHorizon } from '../db/occurrences'
import { clearRestoreSkip } from '../lib/restoreSkip'

type Camino = 'carpeta' | 'zip' | 'json'

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
  const [camino, setCamino] = useState<Camino>(() => (canUseFolderBackup() ? 'carpeta' : 'zip'))
  const caminoActivo = camino === 'carpeta' && !folderOk ? 'zip' : camino

  async function finishRestore(): Promise<void> {
    await ensureHorizon()
    clearRestoreSkip()
    onRestored?.()
  }

  async function confirmIfNeeded(kind: string): Promise<boolean> {
    if (!(await hasUserData())) return true
    return confirm(
      `Esto REEMPLAZA todos los datos de este dispositivo por la copia (${kind}). ¿Continuar?`,
    )
  }

  async function fromFile(file: File | undefined): Promise<void> {
    if (!file) return
    const label = caminoActivo === 'json' ? 'JSON' : 'ZIP'
    if (!(await confirmIfNeeded(label))) return
    setBusy(true)
    setMessage('')
    try {
      const kind = await importBackup(file, 'replace')
      await finishRestore()
      const note =
        kind === 'json'
          ? ' JSON no trae fotos ni documentos.'
          : ' ZIP completo con archivos.'
      setMessage(`Datos recuperados desde ${backupKindLabel(kind)}.${note}`)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'No se pudo restaurar el archivo.')
    } finally {
      setBusy(false)
    }
  }

  async function fromFolder(): Promise<void> {
    if (!(await confirmIfNeeded('carpeta'))) return
    setBusy(true)
    setMessage('')
    try {
      const handle = await pickBackupFolder()
      await restoreFromFolder(handle, 'replace')
      await finishRestore()
      setMessage(`Datos recuperados desde la carpeta (archivo ${BACKUP_FILE_NAME}).`)
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

  const hint =
    caminoActivo === 'carpeta'
      ? `Elige la carpeta donde guardaste ${BACKUP_FILE_NAME}.`
      : caminoActivo === 'zip'
        ? 'Elige el archivo .zip que descargaste o te compartieron.'
        : 'Elige el archivo .json (solo datos; sin fotos).'

  const body = (
    <>
      {embedded ? null : <h2 className="title-sm">Recuperar datos</h2>}
      <p className="muted">Usa el mismo tipo con el que guardaste la copia.</p>

      <p className="backup-step-label">1. Tipo (el mismo con el que guardaste)</p>
      <div className="seg-toggle tabs-3" role="radiogroup" aria-label="Tipo de copia">
        <button
          type="button"
          role="radio"
          aria-checked={caminoActivo === 'carpeta'}
          className={caminoActivo === 'carpeta' ? 'active' : ''}
          disabled={!folderOk}
          onClick={() => setCamino('carpeta')}
        >
          Carpeta
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={caminoActivo === 'zip'}
          className={caminoActivo === 'zip' ? 'active' : ''}
          onClick={() => setCamino('zip')}
        >
          ZIP
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={caminoActivo === 'json'}
          className={caminoActivo === 'json' ? 'active' : ''}
          onClick={() => setCamino('json')}
        >
          JSON
        </button>
      </div>
      <p className="muted backup-camino-hint">{hint}</p>

      <p className="backup-step-label">2. Restaurar</p>
      <div className="backup-actions">
        {caminoActivo === 'carpeta' ? (
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => void fromFolder()}
          >
            <FolderOpen size={16} />
            Restaurar desde carpeta
          </button>
        ) : null}
        {caminoActivo === 'zip' ? (
          <label className="btn btn-primary">
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
                void fromFile(file)
              }}
            />
          </label>
        ) : null}
        {caminoActivo === 'json' ? (
          <label className="btn btn-primary">
            <FileJson size={16} />
            Elegir archivo JSON
            <input
              className="sr-only"
              type="file"
              accept=".json,application/json"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                void fromFile(file)
              }}
            />
          </label>
        ) : null}
        {onSkip ? (
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={onSkip}>
            Empezar de cero
          </button>
        ) : null}
      </div>
      {message ? (
        <p className="hint" style={{ marginTop: '0.75rem' }}>
          {message}
        </p>
      ) : null}
    </>
  )

  if (embedded) return <div className="restore-embedded">{body}</div>

  return (
    <section className={`card restore-panel${compact ? ' restore-panel-compact' : ''}`}>
      {body}
    </section>
  )
}
