import { useState } from 'react'
import {
  Cloud,
  CloudOff,
  LogIn,
  LogOut,
  RefreshCw,
  RotateCcw,
  UploadCloud,
} from 'lucide-react'
import {
  formatBackupSize,
  listGmailBackups,
  restoreFromGmail,
  uploadBackupToGmail,
  type CloudBackupProgress,
  type CloudRestoreProgress,
  type RemoteBackupRef,
} from '../backup'
import { formatDateTime } from '../lib/dates'
import { useGoogleAuth } from '../hooks/useGoogleAuth'
import { EntityCard } from './EntityCard'
import { Modal } from './ui'

function statusLabel(status: string, email: string | null): string {
  switch (status) {
    case 'unavailable':
      return 'Copia en Google no configurada en esta instalación.'
    case 'connecting':
      return 'Conectando con Google…'
    case 'connected':
      return email ? `Conectado como ${email}` : 'Conectado a Google'
    case 'expired':
      return email
        ? `Sesión de ${email} caducada. Vuelve a conectar.`
        : 'Sesión de Google caducada. Vuelve a conectar.'
    case 'error':
      return 'No se pudo conectar con Google.'
    default:
      return 'Conecta tu cuenta de Google para copias entre dispositivos.'
  }
}

function uploadProgressLabel(step: CloudBackupProgress | null): string {
  switch (step) {
    case 'preparing':
      return 'Preparando copia…'
    case 'compressing':
      return 'Comprimiendo…'
    case 'uploading':
      return 'Subiendo a Gmail…'
    case 'done':
      return 'Copia creada correctamente.'
    case 'error':
      return 'No se pudo crear la copia.'
    default:
      return ''
  }
}

function restoreProgressLabel(step: CloudRestoreProgress | null): string {
  switch (step) {
    case 'downloading':
      return 'Descargando copia…'
    case 'validating':
      return 'Comprobando integridad…'
    case 'restoring':
      return 'Restaurando datos…'
    case 'done':
      return 'Datos restaurados.'
    case 'error':
      return 'No se pudo restaurar.'
    default:
      return ''
  }
}

function formatBackupWhen(createdAt: string): string {
  const ts = Date.parse(createdAt)
  return formatDateTime(Number.isFinite(ts) ? ts : Date.now())
}

export function GoogleAccountPanel() {
  const auth = useGoogleAuth()
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState('')
  const [localOk, setLocalOk] = useState('')
  const [uploadProgress, setUploadProgress] = useState<CloudBackupProgress | null>(null)
  const [restoreProgress, setRestoreProgress] = useState<CloudRestoreProgress | null>(null)
  const [backups, setBackups] = useState<RemoteBackupRef[] | null>(null)
  const [pendingRestore, setPendingRestore] = useState<RemoteBackupRef | null>(null)

  const connected = auth.status === 'connected'
  const canConnect =
    auth.configured &&
    (auth.status === 'disconnected' ||
      auth.status === 'expired' ||
      auth.status === 'error' ||
      auth.status === 'idle')

  async function onConnect(): Promise<void> {
    setBusy(true)
    setLocalError('')
    setLocalOk('')
    try {
      await auth.connect()
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'No se pudo conectar con Google.')
    } finally {
      setBusy(false)
    }
  }

  async function onDisconnect(): Promise<void> {
    setBusy(true)
    setLocalError('')
    setLocalOk('')
    setBackups(null)
    setPendingRestore(null)
    try {
      await auth.disconnect()
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'No se pudo desconectar.')
    } finally {
      setBusy(false)
    }
  }

  async function onCreateBackup(): Promise<void> {
    setBusy(true)
    setLocalError('')
    setLocalOk('')
    setPendingRestore(null)
    setUploadProgress('preparing')
    try {
      const ref = await uploadBackupToGmail((step) => setUploadProgress(step))
      setLocalOk(`Copia creada (${formatBackupSize(ref.size)}).`)
      setUploadProgress('done')
      const list = await listGmailBackups()
      setBackups(list)
    } catch (err) {
      setUploadProgress('error')
      setLocalError(err instanceof Error ? err.message : 'No se pudo crear la copia.')
    } finally {
      setBusy(false)
    }
  }

  async function onRefreshList(): Promise<void> {
    setBusy(true)
    setLocalError('')
    setPendingRestore(null)
    try {
      const list = await listGmailBackups()
      setBackups(list)
      if (list.length === 0) setLocalOk('No hay copias de MaintManage en este Gmail todavía.')
      else setLocalOk('')
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'No se pudieron listar las copias.')
    } finally {
      setBusy(false)
    }
  }

  async function onConfirmRestore(): Promise<void> {
    if (!pendingRestore) return
    const target = pendingRestore
    setBusy(true)
    setLocalError('')
    setLocalOk('')
    setRestoreProgress('downloading')
    try {
      await restoreFromGmail(target.remoteId, (step) => setRestoreProgress(step))
      setPendingRestore(null)
      setLocalOk(
        `Datos restaurados desde la copia del ${formatBackupWhen(target.createdAt)}.`,
      )
      setRestoreProgress('done')
    } catch (err) {
      setRestoreProgress('error')
      setLocalError(err instanceof Error ? err.message : 'No se pudo restaurar la copia.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <EntityCard
      title={
        <h2 className="title-sm">
          <span className="accordion-label">
            {connected ? <Cloud size={16} /> : <CloudOff size={16} />}
            Cuenta Google
          </span>
        </h2>
      }
    >
      <p className="backup-status-line muted">{statusLabel(auth.status, auth.email)}</p>
      {!auth.configured ? (
        <p className="muted" style={{ marginTop: 0 }}>
          El administrador debe definir <code>VITE_GOOGLE_CLIENT_ID</code> en el entorno de
          compilación.
        </p>
      ) : (
        <p className="muted" style={{ marginTop: 0 }}>
          Las copias se guardan como correos en tu Gmail. No se guarda tu contraseña.
        </p>
      )}

      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        {canConnect || auth.status === 'connecting' ? (
          <button
            type="button"
            className="btn"
            disabled={busy || !auth.configured || auth.status === 'connecting'}
            onClick={() => void onConnect()}
          >
            <LogIn size={16} />
            {auth.status === 'expired' ? 'Volver a conectar' : 'Conectar Google'}
          </button>
        ) : null}
        {connected || auth.status === 'expired' ? (
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy}
            onClick={() => void onDisconnect()}
          >
            <LogOut size={16} />
            Desconectar
          </button>
        ) : null}
      </div>

      {connected ? (
        <>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => void onCreateBackup()}
            >
              <UploadCloud size={16} />
              Crear copia ahora
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => void onRefreshList()}
            >
              <RefreshCw size={16} />
              Ver copias
            </button>
          </div>

          {uploadProgress && uploadProgress !== 'done' && uploadProgress !== 'error' ? (
            <p className="muted" style={{ marginTop: 8 }}>
              {uploadProgressLabel(uploadProgress)}
            </p>
          ) : null}
          {restoreProgress && restoreProgress !== 'done' && restoreProgress !== 'error' ? (
            <p className="muted" style={{ marginTop: 8 }}>
              {restoreProgressLabel(restoreProgress)}
            </p>
          ) : null}

          {pendingRestore ? (
            <Modal
              open
              title="¿Restaurar esta copia?"
              onClose={() => {
                if (!busy) setPendingRestore(null)
              }}
              footer={
                <>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={busy}
                    onClick={() => setPendingRestore(null)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn"
                    disabled={busy}
                    onClick={() => void onConfirmRestore()}
                  >
                    <RotateCcw size={16} />
                    Restaurar
                  </button>
                </>
              }
            >
              <div className="inbox-alert" role="status" style={{ marginBottom: '0.75rem' }}>
                <span className="inbox-alert-pulse" aria-hidden />
                <span className="inbox-alert-text">
                  Se reemplazarán los datos actuales de este dispositivo.
                </span>
              </div>
              <p className="muted" style={{ margin: 0 }}>
                Copia del <strong>{formatBackupWhen(pendingRestore.createdAt)}</strong>
                {pendingRestore.deviceName ? ` · ${pendingRestore.deviceName}` : ''}
                {pendingRestore.size
                  ? ` · ${formatBackupSize(pendingRestore.size)}`
                  : ''}
                .
              </p>
            </Modal>
          ) : null}

          {backups && backups.length > 0 ? (
            <div style={{ marginTop: 12 }}>
              <p className="backup-step-label">Copias disponibles</p>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {backups.slice(0, 10).map((b) => (
                  <li
                    key={b.remoteId}
                    className="muted"
                    style={{
                      marginBottom: 10,
                      paddingBottom: 8,
                      borderBottom: '1px solid var(--border, #e2e8f0)',
                    }}
                  >
                    <div>
                      <strong>{formatBackupWhen(b.createdAt)}</strong>
                      {' · '}
                      {formatBackupSize(b.size)}
                      {b.deviceName ? ` · ${b.deviceName}` : ''}
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ marginTop: 6 }}
                      disabled={busy}
                      onClick={() => {
                        setLocalError('')
                        setLocalOk('')
                        setPendingRestore(b)
                      }}
                    >
                      <RotateCcw size={16} />
                      Restaurar esta copia
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}

      {localOk ? (
        <div className="hint" style={{ marginTop: 8 }}>
          {localOk}
        </div>
      ) : null}
      {localError || auth.error ? (
        <div className="hint" role="alert" style={{ marginTop: 8 }}>
          {localError || auth.error}
        </div>
      ) : null}
    </EntityCard>
  )
}
