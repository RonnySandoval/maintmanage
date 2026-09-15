import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
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
  type RemoteBackupRef,
} from '../backup'
import { db } from '../db'
import { markBackupDone } from '../db/backup'
import { formatDateTime } from '../lib/dates'
import { GMAIL_RESTORE_STEPS, GMAIL_UPLOAD_STEPS } from '../lib/dataProcess'
import {
  getCurrentGmailRemoteId,
  setCurrentGmailRemoteId,
} from '../lib/gmailCurrentBackup'
import { useGoogleAuth } from '../hooks/useGoogleAuth'
import { useDataProcess } from '../hooks/useDataProcess'
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

function isCurrentGmailBackup(
  backup: RemoteBackupRef,
  currentRemoteId: string | null,
  lastChangedAt?: number,
  lastBackupAt?: number,
): boolean {
  if (!currentRemoteId || backup.remoteId !== currentRemoteId) return false
  if (!lastChangedAt) return true
  if (!lastBackupAt) return false
  return lastChangedAt <= lastBackupAt
}

export function GoogleAccountPanel({ embedded = false }: { embedded?: boolean } = {}) {
  const auth = useGoogleAuth()
  const ajustes = useLiveQuery(() => db.ajustes.get('app'))
  const { session, run, dismiss } = useDataProcess()
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState('')
  const [localOk, setLocalOk] = useState('')
  const [backups, setBackups] = useState<RemoteBackupRef[] | null>(null)
  const [pendingRestore, setPendingRestore] = useState<RemoteBackupRef | null>(null)

  const working = busy || !!session
  const currentRemoteId = getCurrentGmailRemoteId()

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
    try {
      const ref = await run<RemoteBackupRef>({
        title: 'Creando copia en Gmail',
        steps: GMAIL_UPLOAD_STEPS,
        successTitle: 'Copia creada',
        successMessage: (created) =>
          `La copia se guardó en tu Gmail (${formatBackupSize(created.size)}).`,
        errorTitle: 'No se pudo crear la copia',
        work: async (advance) =>
          uploadBackupToGmail((step) => {
            if (step !== 'done' && step !== 'error') advance(step)
          }),
      })
      setCurrentGmailRemoteId(ref.remoteId)
      setLocalOk(`Copia creada (${formatBackupSize(ref.size)}).`)
      const list = await listGmailBackups()
      setBackups(list)
    } catch (err) {
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
    setPendingRestore(null)
    setBusy(true)
    setLocalError('')
    setLocalOk('')
    try {
      await run({
        title: 'Restaurando desde Gmail',
        steps: GMAIL_RESTORE_STEPS,
        successTitle: 'Restauración completada',
        successMessage: `Los datos de este dispositivo coinciden con la copia del ${formatBackupWhen(target.createdAt)}.`,
        errorTitle: 'No se pudo restaurar',
        work: async (advance) => {
          await restoreFromGmail(target.remoteId, (step) => {
            if (step !== 'done' && step !== 'error') advance(step)
          })
        },
      })
      setCurrentGmailRemoteId(target.remoteId)
      await markBackupDone('gmail')
      setLocalOk(`Datos restaurados desde la copia del ${formatBackupWhen(target.createdAt)}.`)
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'No se pudo restaurar la copia.')
    } finally {
      setBusy(false)
    }
  }

  const body = (
    <>
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
              disabled={working || !auth.configured || auth.status === 'connecting'}
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
              disabled={working}
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
                disabled={working}
                onClick={() => void onCreateBackup()}
              >
                <UploadCloud size={16} />
                Crear copia ahora
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={working}
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
                  if (!working) setPendingRestore(null)
                }}
                footer={
                  <>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={working}
                      onClick={() => setPendingRestore(null)}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={working}
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
                  {backups.slice(0, 10).map((b) => {
                    const isCurrent = isCurrentGmailBackup(
                      b,
                      currentRemoteId,
                      ajustes?.lastChangedAt,
                      ajustes?.lastBackupAt,
                    )
                    return (
                      <li key={b.remoteId}>
                        <article
                          className={`gmail-backup-card card${isCurrent ? ' is-current' : ''}`}
                        >
                          <div className="gmail-backup-card-body">
                            {isCurrent ? (
                              <span className="gmail-backup-current-badge">Copia actual</span>
                            ) : null}
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
                            disabled={working}
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
                    )
                  })}
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
    </>
  )

  return (
    <>
      <DataProcessOverlay session={session} onDismiss={dismiss} />
      {embedded ? (
        body
      ) : (
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
          {body}
        </EntityCard>
      )}
    </>
  )
}
