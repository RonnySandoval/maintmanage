import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Bell,
  Download,
  FolderOpen,
  FolderX,
  Monitor,
  Moon,
  Smartphone,
  Sun,
  Upload,
} from 'lucide-react'
import { db } from '../db'
import {
  canUseFolderBackup,
  downloadBlob,
  exportBackup,
  hasUserData,
  importBackup,
  pickBackupFolder,
  restoreFromFolder,
  unlinkBackupFolder,
  writeBackupToFolder,
} from '../db/backup'
import { ensureHorizon } from '../db/occurrences'
import { formatBytes, formatDateTime } from '../lib/dates'
import { saveBackupNow } from '../lib/autoBackup'
import { requestNotificaciones } from '../lib/notifications'
import { RestorePanel } from '../components/RestorePanel'
import { useInstallPrompt } from '../hooks/useInstallPrompt'
import { useTheme } from '../hooks/useTheme'
import type { ThemeMode } from '../db/types'

export function AjustesPage() {
  const ajustes = useLiveQuery(() => db.ajustes.get('app'))
  const { mode, setTheme } = useTheme()
  const { canInstall, installed, install } = useInstallPrompt()
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [quota, setQuota] = useState<string>('')

  async function loadQuota() {
    const est = await navigator.storage?.estimate()
    if (!est) {
      setQuota('El navegador no informa del espacio usado.')
      return
    }
    const used = est.usage ?? 0
    const total = est.quota ?? 0
    setQuota(
      total
        ? `${formatBytes(used)} de ${formatBytes(total)} usados en este origen.`
        : formatBytes(used),
    )
  }

  const folderOk = canUseFolderBackup()
  const pendingChanges =
    !!ajustes?.lastChangedAt &&
    (!ajustes.lastBackupAt || ajustes.lastChangedAt > ajustes.lastBackupAt)

  async function exportNow() {
    setBusy(true)
    setMessage('')
    try {
      const { blob, filename } = await exportBackup()
      downloadBlob(blob, filename)
      setMessage(`Copia lista (${formatBytes(blob.size)}). Pásala al otro dispositivo e impórtala.`)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'No se pudo exportar.')
    } finally {
      setBusy(false)
    }
  }

  async function saveNow() {
    setBusy(true)
    setMessage('')
    try {
      const result = await saveBackupNow()
      setMessage(
        result.kind === 'folder'
          ? `Copia actualizada en la carpeta «${ajustes?.backupFolderName || 'elegida'}» (${formatBytes(result.size)}).`
          : `ZIP descargado (${formatBytes(result.size)}). Guárdalo en Drive, USB o WhatsApp.`,
      )
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'No se pudo guardar la copia.')
    } finally {
      setBusy(false)
    }
  }

  async function chooseFolder() {
    setBusy(true)
    setMessage('')
    try {
      const handle = await pickBackupFolder()
      if (await hasUserData()) {
        const size = await writeBackupToFolder(handle)
        setMessage(`Carpeta «${handle.name}» lista. Copia escrita (${formatBytes(size)}).`)
      } else {
        setMessage(`Carpeta «${handle.name}» lista. Las copias se escribirán aquí automáticamente.`)
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setMessage('')
        return
      }
      setMessage(err instanceof Error ? err.message : 'No se pudo elegir la carpeta.')
    } finally {
      setBusy(false)
    }
  }

  async function restoreFolder(modeImport: 'replace' | 'merge') {
    const ok = confirm(
      modeImport === 'replace'
        ? 'Esto REEMPLAZA todos los datos locales por los de la carpeta. ¿Continuar?'
        : 'Se fusionarán registros por identificador. ¿Continuar?',
    )
    if (!ok) return
    setBusy(true)
    setMessage('')
    try {
      const handle = await pickBackupFolder()
      await restoreFromFolder(handle, modeImport)
      await ensureHorizon()
      setMessage('Datos recuperados desde la carpeta de copias.')
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setMessage('')
        return
      }
      setMessage(err instanceof Error ? err.message : 'No se pudo restaurar desde la carpeta.')
    } finally {
      setBusy(false)
    }
  }

  async function forgetFolder() {
    setBusy(true)
    try {
      await unlinkBackupFolder()
      setMessage('Ya no se escribirá en esa carpeta. Puedes volver a elegirla cuando quieras.')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'No se pudo olvidar la carpeta.')
    } finally {
      setBusy(false)
    }
  }

  async function toggleAutoBackup() {
    const next = ajustes?.autoBackup === false
    await db.ajustes.update('app', { autoBackup: next })
  }

  async function importNow(file: File | undefined, modeImport: 'replace' | 'merge') {
    if (!file) return
    const ok = confirm(
      modeImport === 'replace'
        ? 'Esto REEMPLAZA todos los datos locales por los del archivo. ¿Continuar?'
        : 'Se fusionarán registros por identificador (los del archivo pisan los locales si coinciden). ¿Continuar?',
    )
    if (!ok) return
    setBusy(true)
    setMessage('')
    try {
      await importBackup(file, modeImport)
      await ensureHorizon()
      setMessage('Copia importada. Ya puedes trabajar con esos datos en este dispositivo.')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'No se pudo importar.')
    } finally {
      setBusy(false)
    }
  }

  async function enableNotifs() {
    const ok = await requestNotificaciones()
    setMessage(
      ok
        ? 'Avisos activados. Verás un recordatorio al abrir la app si hay fichas vencidas o pendientes.'
        : 'No se concedió el permiso de notificaciones (o este navegador no las soporta).',
    )
  }

  const themes: { id: ThemeMode; label: string; icon: typeof Sun }[] = [
    { id: 'light', label: 'Claro', icon: Sun },
    { id: 'dark', label: 'Oscuro', icon: Moon },
    { id: 'system', label: 'Sistema', icon: Monitor },
  ]

  return (
    <div className="stack">
      <section className="card">
        <h2 className="title-sm">Apariencia</h2>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {themes.map((t) => {
            const Icon = t.icon
            return (
              <button
                key={t.id}
                type="button"
                className={`btn${mode === t.id ? ' btn-primary' : ''}`}
                onClick={() => setTheme(t.id)}
              >
                <Icon size={16} />
                {t.label}
              </button>
            )
          })}
        </div>
      </section>

      <section className="card">
        <h2 className="title-sm">Estados de la ficha</h2>
        <ul className="estado-help">
          <li>
            <strong>Pendiente</strong> — del mes actual y aún no ejecutada.
          </li>
          <li>
            <strong>Programada</strong> — del trimestre, en un mes que todavía no llega.
          </li>
          <li>
            <strong>Planificada</strong> — más allá del trimestre. Se ve en el cronograma, no en el dashboard.
          </li>
          <li>
            <strong>Vencida</strong> — la fecha ya pasó y no se ejecutó.
          </li>
          <li>
            <strong>Ejecutada</strong> — registrada como hecha.
          </li>
        </ul>
      </section>

      <section className="card">
        <h2 className="title-sm">Recordatorios</h2>
        <p className="muted">
          Sin servidor no hay avisos con la app cerrada. Al abrirla (o volver a ella) se puede
          notificar si hay vencidas o pendientes del mes, una vez al día.
        </p>
        <button type="button" className="btn" onClick={() => void enableNotifs()}>
          <Bell size={16} />
          {ajustes?.notificaciones ? 'Permiso concedido — volver a pedir' : 'Activar avisos al abrir'}
        </button>
      </section>

      <section className="card">
        <h2 className="title-sm">Instalar en este dispositivo</h2>
        {installed ? (
          <p className="muted">La app ya está en modo instalado (PWA).</p>
        ) : canInstall ? (
          <button type="button" className="btn btn-primary" onClick={() => void install()}>
            <Smartphone size={16} />
            Instalar MaintManage
          </button>
        ) : (
          <p className="muted">
            En el móvil: menú del navegador → <strong>Añadir a pantalla de inicio</strong>. En el
            PC: icono de instalar en la barra de direcciones, si el navegador lo ofrece.
          </p>
        )}
      </section>

      <section className="card">
        <h2 className="title-sm">Copia de seguridad</h2>
        <p className="muted">
          Al abrir la app se revisa si hay datos nuevos. Si pasaron 12 horas y cambió algo, se
          actualiza la copia. En el PC elige una carpeta (OneDrive o Drive, si puedes) para que
          sobreviva si borras la app. En el móvil guarda el ZIP fuera del navegador.
        </p>
        <ul className="backup-status">
          <li>
            Última copia:{' '}
            <strong>
              {ajustes?.lastBackupAt ? formatDateTime(ajustes.lastBackupAt) : 'aún no hay'}
            </strong>
            {ajustes?.lastBackupKind === 'folder' ? ' (carpeta)' : null}
            {ajustes?.lastBackupKind === 'download' ? ' (ZIP descargado)' : null}
          </li>
          <li>
            Carpeta:{' '}
            <strong>
              {ajustes?.backupFolderName ? `«${ajustes.backupFolderName}»` : 'ninguna'}
            </strong>
          </li>
          <li>
            Estado:{' '}
            <strong>{pendingChanges ? 'hay cambios sin copiar' : 'al día'}</strong>
          </li>
        </ul>
        <label className="backup-toggle">
          <input
            type="checkbox"
            checked={ajustes?.autoBackup !== false}
            onChange={() => void toggleAutoBackup()}
          />
          Copia automática (máximo 2 veces al día, solo si hay cambios)
        </label>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {folderOk ? (
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void chooseFolder()}>
              <FolderOpen size={16} />
              {ajustes?.backupFolderName ? 'Cambiar carpeta' : 'Elegir carpeta de copias'}
            </button>
          ) : null}
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void saveNow()}>
            <Download size={16} />
            Guardar copia ahora
          </button>
          <button type="button" className="btn" disabled={busy} onClick={() => void exportNow()}>
            <Download size={16} />
            Descargar ZIP
          </button>
          {ajustes?.backupFolderName ? (
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void forgetFolder()}>
              <FolderX size={16} />
              Dejar de usar la carpeta
            </button>
          ) : null}
        </div>
      </section>

      <RestorePanel compact />

      <section className="card">
        <h2 className="title-sm">Importar en este dispositivo</h2>
        <p className="muted">
          Reemplazar deja este aparato igual que la copia. Fusionar añade registros; si el id
          coincide, gana el archivo.
        </p>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {folderOk ? (
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => void restoreFolder('replace')}
            >
              <FolderOpen size={16} />
              Restaurar desde carpeta
            </button>
          ) : null}
          <label className="btn">
            <Upload size={16} />
            ZIP (reemplazar)
            <input
              className="sr-only"
              type="file"
              accept=".zip,application/zip"
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                void importNow(file, 'replace')
              }}
            />
          </label>
          <label className="btn">
            <Upload size={16} />
            ZIP (fusionar)
            <input
              className="sr-only"
              type="file"
              accept=".zip,application/zip"
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                void importNow(file, 'merge')
              }}
            />
          </label>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => void loadQuota()}>
          Ver espacio usado
        </button>
        {quota ? <p className="muted">{quota}</p> : null}
      </section>

      {message ? <div className="hint">{message}</div> : null}

      <section className="card">
        <h2 className="title-sm">Acerca de</h2>
        <p className="muted">
          MaintManage funciona sin servidor. GitHub Pages solo entrega la aplicación. La copia de
          seguridad vive en la carpeta o el ZIP que elijas, no en la web. Fotos y documentos
          grandes ocupan cuota del navegador. Word se almacena; la vista previa rica no está
          incluida. iOS comparte peor archivos que Android.
        </p>
      </section>
    </div>
  )
}
