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
import { gmailRestoreProcess, gmailUploadProcess } from '../lib/dataProcess'
import { useGoogleAuth } from '../hooks/useGoogleAuth'
import { DataProcessOverlay } from './DataProcessOverlay'
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

  const dataProcess =
    gmailUploadProcess(uploadProgress) ?? gmailRestoreProcess(restoreProgress)

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
    <>
    <DataProcessOverlay state={dataProcess} />
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
          Falta el Client ID de Google en esta instalación. Actualiza la app o revisa
          google-oauth.json.
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

          {pendingRestore ? (
            <Modal
              open
              title={
                <span className="restore-confirm-title">
                  <span className="restore-confirm-warn" aria-hidden>
                    !
                  </span>
                  ¿Restaurar esta copia?
                </span>
              }
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
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() => void onConfirmRestore()}
                  >
                    <RotateCcw size={16} />
                    Restaurar
                  </button>
                </>
              }
            >
              <div className="restore-confirm-body">
                <div className="restore-confirm-info">
                  <p className="restore-confirm-datetime">
                    {formatBackupWhen(pendingRestore.createdAt)}
                  </p>
                  <p className="restore-confirm-meta muted">
                    {formatBackupSize(pendingRestore.size)}
                    {pendingRestore.deviceName ? ` · ${pendingRestore.deviceName}` : ''}
                  </p>
                </div>
                <div className="inbox-alert restore-confirm-alert" role="status">
                  <span className="inbox-alert-pulse" aria-hidden />
                  <span className="inbox-alert-text">
                    Se reemplazarán los datos actuales de este dispositivo.
                  </span>
                </div>
              </div>
            </Modal>
          ) : null}

          {backups && backups.length > 0 ? (
            <div className="gmail-backup-list-wrap">
              <p className="backup-step-label">Copias disponibles</p>
              <ul className="gmail-backup-list">
                {backups.slice(0, 10).map((b) => (
                  <li key={b.remoteId}>
                    <article className="gmail-backup-card card">
                      <div className="gmail-backup-card-body">
                        <time className="gmail-backup-card-date" dateTime={b.createdAt}>
                          {formatBackupWhen(b.createdAt)}
                        </time>
                        <p className="gmail-backup-card-meta muted">
                          {formatBackupSize(b.size)}
                          {b.deviceName ? ` · ${b.deviceName}` : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="btn btn-primary gmail-backup-restore-btn"
                        disabled={busy}
                        onClick={() => {
                          setLocalError('')
                          setLocalOk('')
                          setPendingRestore(b)
                        }}
                      >
                        <RotateCcw size={16} aria-hidden />
                        Restaurar
                      </button>
                    </article>
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
    </>
  )
}
