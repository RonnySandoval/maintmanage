import { useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Bell,
  ChevronDown,
  CircleHelp,
  DatabaseBackup,
  Download,
  FolderOpen,
  FolderInput,
  FolderX,
  Info,
  Smartphone,
  Type,
  Upload,
  type LucideIcon,
} from 'lucide-react'
import { db } from '../db'
import {
  backupIntervalHoursOf,
  backupIntervalMsOf,
  canUseFolderBackup,
  DEFAULT_BACKUP_INTERVAL_HOURS,
  downloadBlob,
  exportBackup,
  hasUserData,
  importBackup,
  MAX_BACKUP_INTERVAL_HOURS,
  MIN_BACKUP_INTERVAL_HOURS,
  nextBackupAtOf,
  pickBackupFolder,
  restoreFromFolder,
  unlinkBackupFolder,
  writeBackupToFolder,
} from '../db/backup'
import { ensureHorizon } from '../db/occurrences'
import { formatBytes, formatDateTime, toDatetimeLocalValue } from '../lib/dates'
import { saveBackupNow } from '../lib/autoBackup'
import {
  ALIAS_FIELDS,
  DEFAULT_ALIASES,
  label,
  type AliasKey,
  type AliasMap,
  useAliases,
} from '../lib/labels'
import { requestNotificaciones } from '../lib/notifications'
import { RestorePanel } from '../components/RestorePanel'
import { useInstallPrompt } from '../hooks/useInstallPrompt'

type AjustesTab = 'copia' | 'nombres' | 'avisos' | 'estados' | 'acerca'

const AJUSTES_TABS: { id: AjustesTab; label: string; icon: LucideIcon }[] = [
  { id: 'copia', label: 'Copia', icon: DatabaseBackup },
  { id: 'nombres', label: 'Nombres', icon: Type },
  { id: 'avisos', label: 'Avisos', icon: Bell },
  { id: 'estados', label: 'Estados', icon: CircleHelp },
  { id: 'acerca', label: 'Acerca', icon: Info },
]

function tabFromParam(value: string | null): AjustesTab {
  if (value === 'nombres' || value === 'avisos' || value === 'estados' || value === 'acerca') {
    return value
  }
  return 'copia'
}

export function AjustesPage() {
  const [params, setParams] = useSearchParams()
  const tab = tabFromParam(params.get('tab'))
  const ajustes = useLiveQuery(() => db.ajustes.get('app'))
  const { canInstall, installed, install } = useInstallPrompt()
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [quota, setQuota] = useState<string>('')
  const [aliasDrafts, setAliasDrafts] = useState<AliasMap>({})
  const [aliasFocus, setAliasFocus] = useState<AliasKey | null>(null)

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

  const aliases = useAliases()
  const intervalHours = backupIntervalHoursOf(ajustes?.backupIntervalHours)
  const nextBackupAt = nextBackupAtOf(ajustes)
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

  async function saveIntervalHours(raw: string) {
    const hours = backupIntervalHoursOf(Number(raw))
    const last = ajustes?.lastBackupAt ?? Date.now()
    await db.ajustes.update('app', {
      backupIntervalHours: hours,
      nextBackupAt: last + backupIntervalMsOf(hours),
    })
  }

  async function saveNextBackup(raw: string) {
    const ts = new Date(raw).getTime()
    if (!Number.isFinite(ts)) return
    await db.ajustes.update('app', { nextBackupAt: ts })
  }

  function aliasValue(key: AliasKey): string {
    if (aliasFocus === key && aliasDrafts[key] !== undefined) return aliasDrafts[key] as string
    return aliases[key] ?? DEFAULT_ALIASES[key]
  }

  async function saveAlias(key: AliasKey, value: string) {
    const next = { ...(ajustes?.aliases ?? {}) }
    const stored = value.trim()
    if (!stored) delete next[key]
    else next[key] = stored
    await db.ajustes.update('app', { aliases: next })
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

  function setTab(next: AjustesTab) {
    const nextParams = new URLSearchParams(params)
    if (next === 'copia') nextParams.delete('tab')
    else nextParams.set('tab', next)
    setParams(nextParams, { replace: true })
  }

  return (
    <div>
      <div className="seg-toggle tabs-5" role="tablist" aria-label="Secciones de ajustes">
        {AJUSTES_TABS.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={tab === item.id ? 'active' : ''}
              onClick={() => setTab(item.id)}
            >
              <Icon size={16} />
              {item.label}
            </button>
          )
        })}
      </div>

      {tab === 'avisos' ? (
        <section className="card">
          <h2 className="title-sm">
            <span className="accordion-label">
              <Bell size={16} />
              Avisos e instalación
            </span>
          </h2>
        <h3 className="title-sm">Recordatorios</h3>
        <p className="muted">
          Sin servidor no hay avisos con la app cerrada. Al abrirla (o volver a ella) se puede
          notificar si hay vencidas o pendientes del mes, una vez al día.
        </p>
        <button type="button" className="btn" onClick={() => void enableNotifs()}>
          <Bell size={16} />
          {ajustes?.notificaciones ? 'Permiso concedido — volver a pedir' : 'Activar avisos al abrir'}
        </button>
        <h3 className="title-sm" style={{ marginTop: '1rem' }}>
          Instalar en este dispositivo
        </h3>
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
      ) : null}

      {tab === 'copia' ? (
        <section className="card">
          <h2 className="title-sm">
            <span className="accordion-label">
              <DatabaseBackup size={16} />
              Copia de seguridad
            </span>
          </h2>
        <p className="muted">
          Al abrir la app se revisa si hay datos nuevos. Si pasó el intervalo y cambió algo, se
          actualiza la copia. En el PC elige una carpeta (OneDrive o Drive, si puedes) para que
          sobreviva si borras la app. En el móvil guarda el ZIP fuera del navegador.
        </p>
        <div className="backup-fields">
          <div className="field">
            <label htmlFor="backup-interval">Intervalo (horas)</label>
            <input
              id="backup-interval"
              className="input"
              type="number"
              min={MIN_BACKUP_INTERVAL_HOURS}
              max={MAX_BACKUP_INTERVAL_HOURS}
              step={1}
              defaultValue={intervalHours}
              key={intervalHours}
              onBlur={(e) => void saveIntervalHours(e.target.value)}
            />
            <p className="muted file-picker-hint">
              Por defecto {DEFAULT_BACKUP_INTERVAL_HOURS} horas. Entre {MIN_BACKUP_INTERVAL_HOURS} y{' '}
              {MAX_BACKUP_INTERVAL_HOURS}.
            </p>
          </div>
          <div className="field">
            <label htmlFor="backup-next">Próxima copia</label>
            <input
              id="backup-next"
              className="input"
              type="datetime-local"
              value={toDatetimeLocalValue(nextBackupAt)}
              onChange={(e) => void saveNextBackup(e.target.value)}
            />
            <p className="muted file-picker-hint">
              {pendingChanges && nextBackupAt <= (ajustes?.lastChangedAt ?? nextBackupAt)
                ? 'Hay cambios: se intentará al abrir la app.'
                : `Programada para ${formatDateTime(nextBackupAt)}.`}
            </p>
          </div>
        </div>
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
          Copia automática (según el intervalo, solo si hay cambios)
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
        {message ? <div className="hint">{message}</div> : null}

        <SettingsAccordion
          title="Importar y recuperar"
          icon={FolderInput}
          summary="ZIP, carpeta o fusionar"
          nested
        >
          <RestorePanel compact embedded />
          <h3 className="title-sm" style={{ marginTop: '1rem' }}>
            Importar en este dispositivo
          </h3>
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
        </SettingsAccordion>
        </section>
      ) : null}

      {tab === 'nombres' ? (
        <section className="card">
          <h2 className="title-sm">
            <span className="accordion-label">
              <Type size={16} />
              Nombres en la app
            </span>
          </h2>
        <p className="muted">
          Cambia cómo se ven el {label('trimestre', aliases)}, las acciones y los tipos de
          actividad. Se respeta mayúsculas y minúsculas tal como las escribas. Déjalo vacío y
          sal del campo para volver al nombre original.
        </p>
        <div className="alias-grid">
          {ALIAS_FIELDS.map((field) => (
            <div key={field.id} className="field">
              <label htmlFor={`alias-${field.id}`}>{DEFAULT_ALIASES[field.id]}</label>
              <input
                id={`alias-${field.id}`}
                className="input"
                value={aliasValue(field.id)}
                placeholder={DEFAULT_ALIASES[field.id]}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                onFocus={() => {
                  setAliasFocus(field.id)
                  setAliasDrafts((prev) => ({
                    ...prev,
                    [field.id]: aliases[field.id] ?? DEFAULT_ALIASES[field.id],
                  }))
                }}
                onChange={(e) => {
                  setAliasDrafts((prev) => ({ ...prev, [field.id]: e.target.value }))
                }}
                onBlur={() => {
                  const raw = aliasDrafts[field.id]
                  setAliasFocus(null)
                  void saveAlias(field.id, raw ?? '')
                }}
              />
              <p className="muted file-picker-hint">{field.hint}</p>
            </div>
          ))}
        </div>
        </section>
      ) : null}

      {tab === 'estados' ? (
        <section className="card">
          <h2 className="title-sm">
            <span className="accordion-label">
              <CircleHelp size={16} />
              Estados de la ficha
            </span>
          </h2>
        <ul className="estado-help">
          <li>
            <strong>Pendiente</strong> — del mes actual y aún no ejecutada.
          </li>
          <li>
            <strong>Programada</strong> — del {label('trimestre', aliases)}, en un mes que
            todavía no llega.
          </li>
          <li>
            <strong>Planificada</strong> — más allá del {label('trimestre', aliases)}. Se ve
            en el cronograma, no en el dashboard.
          </li>
          <li>
            <strong>Vencida</strong> — la fecha ya pasó y no se ejecutó.
          </li>
          <li>
            <strong>Ejecutada</strong> — registrada como hecha.
          </li>
        </ul>
        </section>
      ) : null}

      {tab === 'acerca' ? (
        <section className="card">
          <h2 className="title-sm">
            <span className="accordion-label">
              <Info size={16} />
              Acerca de
            </span>
          </h2>
        <p className="muted">
          MaintManage funciona sin servidor. GitHub Pages solo entrega la aplicación. La copia de
          seguridad vive en la carpeta o el ZIP que elijas, no en la web. Fotos y documentos
          grandes ocupan cuota del navegador. Word se almacena; la vista previa rica no está
          incluida. iOS comparte peor archivos que Android.
        </p>
        </section>
      ) : null}
    </div>
  )
}

function SettingsAccordion({
  title,
  icon: Icon,
  summary,
  defaultOpen = false,
  nested = false,
  children,
}: {
  title: string
  icon?: LucideIcon
  summary?: string
  defaultOpen?: boolean
  nested?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className={`card accordion-panel${nested ? ' settings-nested' : ''}${open ? '' : ' is-collapsed'}`}>
      <button
        type="button"
        className="accordion-trigger"
        aria-expanded={open}
        onClick={() => setOpen((was) => !was)}
      >
        <span className="accordion-label">
          {Icon ? <Icon size={16} /> : null}
          <span>
            {title}
            {!open && summary ? (
              <span className="muted" style={{ fontWeight: 500 }}>
                {' · '}
                {summary}
              </span>
            ) : null}
          </span>
        </span>
        <ChevronDown size={18} className={open ? 'is-open' : ''} />
      </button>
      {open ? <div className="accordion-body">{children}</div> : null}
    </section>
  )
}
