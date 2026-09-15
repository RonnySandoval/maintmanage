import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Bell,
  ChevronDown,
  CircleHelp,
  DatabaseBackup,
  Download,
  FileJson,
  FolderOpen,
  FolderX,
  Info,
  Monitor,
  Share2,
  Smartphone,
  Type,
  Upload,
  type LucideIcon,
} from 'lucide-react'
import { db } from '../db'
import {
  BACKUP_FILE_NAME,
  backupKindLabel,
  backupIntervalHoursOf,
  backupIntervalMsOf,
  canUseFolderBackup,
  canShareZipFiles,
  DEFAULT_BACKUP_INTERVAL_HOURS,
  downloadBlob,
  exportBackupJson,
  exportBackupZip,
  getUsableBackupFolder,
  hasUserData,
  importBackup,
  markBackupDone,
  MAX_BACKUP_INTERVAL_HOURS,
  MIN_BACKUP_INTERVAL_HOURS,
  nextBackupAtOf,
  pickBackupFolder,
  prepareBackupZipForShare,
  restoreFromFolder,
  shareBackupFile,
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
import { EntityCard } from '../components/EntityCard'
import { ThemeModePicker } from '../components/ThemeQuickToggle'
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
  const folderOk = canUseFolderBackup()
  const [copiaPaso, setCopiaPaso] = useState<'guardar' | 'recuperar'>('guardar')
  const [copiaCamino, setCopiaCamino] = useState<'carpeta' | 'zip' | 'json'>(() =>
    canUseFolderBackup() ? 'carpeta' : 'zip',
  )
  const zipShareSupported = canShareZipFiles()
  const shareFileRef = useRef<File | null>(null)
  const shareStampRef = useRef<number>(-1)
  const [sharePrep, setSharePrep] = useState<'idle' | 'preparing' | 'ready' | 'error'>('idle')
  const [shareWarmKey, setShareWarmKey] = useState(0)

  const aliases = useAliases()
  const intervalHours = backupIntervalHoursOf(ajustes?.backupIntervalHours)
  const nextBackupAt = nextBackupAtOf(ajustes)
  const pendingChanges =
    !!ajustes?.lastChangedAt &&
    (!ajustes.lastBackupAt || ajustes.lastChangedAt > ajustes.lastBackupAt)
  const hasFolder = Boolean(ajustes?.backupFolderName)
  const caminoActivo = copiaCamino === 'carpeta' && !folderOk ? 'zip' : copiaCamino
  const dataStamp = ajustes?.lastChangedAt ?? 0

  // Prepara el ZIP en segundo plano para que el click solo abra el menú nativo
  // (si se genera el ZIP en el click, Android/Chrome pierde el gesto y falla share).
  useEffect(() => {
    if (tab !== 'copia' || copiaPaso !== 'guardar' || caminoActivo !== 'zip') return

    let cancelled = false

    async function warm() {
      if (shareFileRef.current && shareStampRef.current === dataStamp) {
        setSharePrep('ready')
        return
      }
      setSharePrep('preparing')
      try {
        const prepared = await prepareBackupZipForShare()
        if (cancelled) return
        shareFileRef.current = prepared.file
        shareStampRef.current = dataStamp
        setSharePrep('ready')
      } catch {
        if (!cancelled) {
          shareFileRef.current = null
          setSharePrep('error')
        }
      }
    }

    void warm()
    return () => {
      cancelled = true
    }
  }, [tab, copiaPaso, caminoActivo, dataStamp, shareWarmKey])

  async function shareZip() {
    const file = shareFileRef.current
    if (!file || sharePrep !== 'ready') {
      setMessage(
        sharePrep === 'preparing'
          ? 'El ZIP se está preparando… espera un momento y pulsa de nuevo.'
          : 'No hay un ZIP listo. Espera a que termine la preparación o usa «Descargar ZIP».',
      )
      return
    }

    // Sin setState ni awaits previos: hace falta conservar el gesto del toque.
    const result = await shareBackupFile(file)

    if (result === 'cancelled') {
      setMessage('')
      return
    }
    if (result === 'shared') {
      shareFileRef.current = null
      shareStampRef.current = -1
      setShareWarmKey((k) => k + 1)
      setMessage('ZIP compartido. En el otro dispositivo restáuralo con «Elegir ZIP».')
      return
    }
    if (result === 'needs-gesture') {
      setMessage(
        'El navegador bloqueó el menú de compartir. Espera a ver el botón listo y pulsa de nuevo sin cambiar de pantalla.',
      )
      return
    }
    if (result === 'unsupported') {
      setMessage(
        'Este navegador no puede adjuntar un ZIP al menú de compartir. Usa «Descargar ZIP» y adjúntalo en WhatsApp.',
      )
      return
    }
    setMessage(
      'No se pudo abrir el menú de compartir. Usa «Descargar ZIP» y adjúntalo en WhatsApp.',
    )
  }

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

  const caminoHint =
    caminoActivo === 'carpeta'
      ? `Carpeta → archivo ${BACKUP_FILE_NAME} (completo, con fotos).`
      : caminoActivo === 'zip'
        ? 'ZIP → archivo .zip completo (datos + fotos). Ideal para móvil o compartir.'
        : 'JSON → archivo .json solo con datos (sin fotos ni documentos).'

  async function exportZip() {
    setBusy(true)
    setMessage('')
    try {
      const { blob, filename } = await exportBackupZip()
      downloadBlob(blob, filename)
      await markBackupDone('zip')
      shareFileRef.current = null
      shareStampRef.current = -1
      setShareWarmKey((k) => k + 1)
      setMessage(
        `ZIP listo (${formatBytes(blob.size)}). Guárdalo o pásalo al otro dispositivo e impórtalo como ZIP.`,
      )
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'No se pudo exportar el ZIP.')
    } finally {
      setBusy(false)
    }
  }

  async function exportJson() {
    setBusy(true)
    setMessage('')
    try {
      const { blob, filename } = await exportBackupJson()
      downloadBlob(blob, filename)
      await markBackupDone('json')
      setMessage(
        `JSON listo (${formatBytes(blob.size)}). Solo datos (sin fotos). Impórtalo como JSON.`,
      )
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'No se pudo exportar el JSON.')
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
          ? `Actualizado en carpeta «${ajustes?.backupFolderName || 'elegida'}» (${formatBytes(result.size)}). Archivo: ${BACKUP_FILE_NAME}.`
          : `ZIP descargado (${formatBytes(result.size)}). Restáuralo con «Elegir ZIP».`,
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
      const linked = await getUsableBackupFolder()
      const handle = linked ?? (await pickBackupFolder())
      await restoreFromFolder(handle, modeImport)
      await ensureHorizon()
      setMessage(
        `Datos recuperados desde carpeta «${handle.name}» (${BACKUP_FILE_NAME} o ZIP maintmanage-*.zip).`,
      )
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
      const kind = await importBackup(file, modeImport)
      await ensureHorizon()
      const extra =
        kind === 'json'
          ? ' El JSON no incluye fotos ni documentos.'
          : ' Incluye archivos del ZIP si venían en la copia.'
      setMessage(
        `Copia ${backupKindLabel(kind)} importada (${modeImport === 'replace' ? 'reemplazo' : 'fusión'}).${extra}`,
      )
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
    <div className="stack ajustes-page">
      <EntityCard
        className="ajustes-apariencia is-inline"
        compact
        title={
          <h2 className="title-sm">
            <span className="accordion-label">
              <Monitor size={16} />
              Apariencia
            </span>
          </h2>
        }
        badge={<ThemeModePicker />}
      />

      <div className="seg-toggle tabs-5 icon-only" role="tablist" aria-label="Secciones de ajustes">
        {AJUSTES_TABS.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              aria-label={item.label}
              title={item.label}
              className={tab === item.id ? 'active' : ''}
              onClick={() => setTab(item.id)}
            >
              <Icon size={16} />
            </button>
          )
        })}
      </div>

      {tab === 'avisos' ? (
        <EntityCard
          title={
            <h2 className="title-sm">
              <span className="accordion-label">
                <Bell size={16} />
                Avisos e instalación
              </span>
            </h2>
          }
          footer={
            <div className="row card-toolbar-actions">
              <button type="button" className="btn" onClick={() => void enableNotifs()}>
                <Bell size={16} />
                {ajustes?.notificaciones ? 'Volver a pedir permiso' : 'Activar avisos'}
              </button>
              {!installed && canInstall ? (
                <button type="button" className="btn btn-primary" onClick={() => void install()}>
                  <Smartphone size={16} />
                  Instalar
                </button>
              ) : null}
            </div>
          }
        >
          <p className="muted">
            Sin servidor no hay avisos con la app cerrada. Al abrirla se puede notificar vencidas o
            pendientes del mes, una vez al día.
          </p>
          {installed ? (
            <p className="muted">La app ya está en modo instalado (PWA).</p>
          ) : canInstall ? null : (
            <p className="muted">
              En el móvil: menú → <strong>Añadir a pantalla de inicio</strong>. En el PC: icono de
              instalar en la barra de direcciones.
            </p>
          )}
          {message ? <div className="hint">{message}</div> : null}
        </EntityCard>
      ) : null}

      {tab === 'copia' ? (
        <>
          <EntityCard
            title={
              <h2 className="title-sm">
                <span className="accordion-label">
                  <DatabaseBackup size={16} />
                  Copia de seguridad
                </span>
              </h2>
            }
          >
            <p className="backup-status-line muted">
              Última:{' '}
              <strong>
                {ajustes?.lastBackupAt ? formatDateTime(ajustes.lastBackupAt) : 'aún no hay'}
              </strong>
              {backupKindLabel(ajustes?.lastBackupKind)
                ? ` · ${backupKindLabel(ajustes?.lastBackupKind)}`
                : ''}
              {' · '}
              {pendingChanges ? 'hay cambios sin copiar' : 'al día'}
              {hasFolder ? ` · carpeta «${ajustes?.backupFolderName}»` : ''}
            </p>
            <p className="muted" style={{ marginTop: 0 }}>
              Elige primero qué quieres hacer y después el mismo tipo al guardar y al recuperar.
            </p>

            <p className="backup-step-label">1. Qué quieres hacer</p>
            <div className="seg-toggle" role="tablist" aria-label="Qué quieres hacer">
              <button
                type="button"
                role="tab"
                aria-selected={copiaPaso === 'guardar'}
                className={copiaPaso === 'guardar' ? 'active' : ''}
                onClick={() => {
                  setCopiaPaso('guardar')
                  setMessage('')
                }}
              >
                Guardar / exportar
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={copiaPaso === 'recuperar'}
                className={copiaPaso === 'recuperar' ? 'active' : ''}
                onClick={() => {
                  setCopiaPaso('recuperar')
                  setMessage('')
                }}
              >
                Recuperar / importar
              </button>
            </div>

            <p className="backup-step-label">2. Tipo de copia</p>
            <div className="seg-toggle tabs-3" role="radiogroup" aria-label="Tipo de copia">
              <button
                type="button"
                role="radio"
                aria-checked={caminoActivo === 'carpeta'}
                className={caminoActivo === 'carpeta' ? 'active' : ''}
                disabled={!folderOk}
                title={folderOk ? 'Carpeta en el PC' : 'No disponible en este navegador'}
                onClick={() => setCopiaCamino('carpeta')}
              >
                Carpeta
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={caminoActivo === 'zip'}
                className={caminoActivo === 'zip' ? 'active' : ''}
                onClick={() => setCopiaCamino('zip')}
              >
                ZIP
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={caminoActivo === 'json'}
                className={caminoActivo === 'json' ? 'active' : ''}
                onClick={() => setCopiaCamino('json')}
              >
                JSON
              </button>
            </div>
            <p className="muted backup-camino-hint">{caminoHint}</p>

            <p className="backup-step-label">
              3. {copiaPaso === 'guardar' ? 'Acción' : 'Restaurar (mismo tipo que usaste al guardar)'}
            </p>

            {copiaPaso === 'guardar' && caminoActivo === 'carpeta' ? (
              <div className="backup-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() => void chooseFolder()}
                >
                  <FolderOpen size={16} />
                  {hasFolder ? 'Cambiar carpeta' : 'Elegir carpeta'}
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={busy || !hasFolder}
                  onClick={() => void saveNow()}
                >
                  <Download size={16} />
                  Guardar en carpeta
                </button>
                {hasFolder ? (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={busy}
                    onClick={() => void forgetFolder()}
                  >
                    <FolderX size={16} />
                    Dejar de usar carpeta
                  </button>
                ) : null}
              </div>
            ) : null}

            {copiaPaso === 'guardar' && caminoActivo === 'zip' ? (
              <div className="backup-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() => void exportZip()}
                >
                  <Download size={16} />
                  Descargar ZIP
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={busy || sharePrep === 'preparing'}
                  onClick={() => {
                    if (sharePrep === 'ready') {
                      void shareZip()
                      return
                    }
                    shareFileRef.current = null
                    shareStampRef.current = -1
                    setShareWarmKey((k) => k + 1)
                  }}
                  title={
                    zipShareSupported
                      ? 'Abre el menú nativo con el ZIP ya preparado'
                      : 'En este navegador puede no estar disponible; usa Descargar ZIP'
                  }
                >
                  <Share2 size={16} />
                  {sharePrep === 'preparing'
                    ? 'Preparando…'
                    : sharePrep === 'ready'
                      ? 'Compartir ZIP'
                      : sharePrep === 'error'
                        ? 'Reintentar preparar'
                        : 'Compartir ZIP'}
                </button>
              </div>
            ) : null}

            {copiaPaso === 'guardar' && caminoActivo === 'zip' && sharePrep === 'ready' ? (
              <p className="muted backup-camino-hint">ZIP listo: al pulsar «Compartir ZIP» se abre el menú para enviarlo.</p>
            ) : null}
            {copiaPaso === 'guardar' && caminoActivo === 'zip' && sharePrep === 'preparing' ? (
              <p className="muted backup-camino-hint">Preparando ZIP en segundo plano…</p>
            ) : null}

            {copiaPaso === 'guardar' && caminoActivo === 'json' ? (
              <div className="backup-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() => void exportJson()}
                >
                  <FileJson size={16} />
                  Descargar JSON
                </button>
                <p className="muted" style={{ margin: 0, width: '100%' }}>
                  Más liviano, pero al recuperar no volverán las fotos.
                </p>
              </div>
            ) : null}

            {copiaPaso === 'recuperar' && caminoActivo === 'carpeta' ? (
              <div className="backup-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() => void restoreFolder('replace')}
                >
                  <Upload size={16} />
                  Restaurar carpeta (reemplazar)
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={() => void restoreFolder('merge')}
                >
                  <Upload size={16} />
                  Fusionar desde carpeta
                </button>
                <p className="muted" style={{ margin: 0, width: '100%' }}>
                  Reemplazar borra lo de este aparato. Fusionar añade y, si el id coincide, gana la
                  copia.
                </p>
              </div>
            ) : null}

            {copiaPaso === 'recuperar' && caminoActivo === 'zip' ? (
              <div className="backup-actions">
                <label className="btn btn-primary">
                  <Upload size={16} />
                  Elegir ZIP (reemplazar)
                  <input
                    className="sr-only"
                    type="file"
                    accept=".zip,application/zip"
                    disabled={busy}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      e.target.value = ''
                      void importNow(file, 'replace')
                    }}
                  />
                </label>
                <label className="btn">
                  <Upload size={16} />
                  Elegir ZIP (fusionar)
                  <input
                    className="sr-only"
                    type="file"
                    accept=".zip,application/zip"
                    disabled={busy}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      e.target.value = ''
                      void importNow(file, 'merge')
                    }}
                  />
                </label>
              </div>
            ) : null}

            {copiaPaso === 'recuperar' && caminoActivo === 'json' ? (
              <div className="backup-actions">
                <label className="btn btn-primary">
                  <Upload size={16} />
                  Elegir JSON (reemplazar)
                  <input
                    className="sr-only"
                    type="file"
                    accept=".json,application/json"
                    disabled={busy}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      e.target.value = ''
                      void importNow(file, 'replace')
                    }}
                  />
                </label>
                <label className="btn">
                  <Upload size={16} />
                  Elegir JSON (fusionar)
                  <input
                    className="sr-only"
                    type="file"
                    accept=".json,application/json"
                    disabled={busy}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      e.target.value = ''
                      void importNow(file, 'merge')
                    }}
                  />
                </label>
                <p className="muted" style={{ margin: 0, width: '100%' }}>
                  Este camino no restaura fotos ni documentos.
                </p>
              </div>
            ) : null}

            {message ? <div className="hint">{message}</div> : null}
          </EntityCard>

          <SettingsAccordion title="Programación automática" icon={DatabaseBackup} summary="Intervalo y próxima copia">
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
                  Por defecto {DEFAULT_BACKUP_INTERVAL_HOURS} h · {MIN_BACKUP_INTERVAL_HOURS}–
                  {MAX_BACKUP_INTERVAL_HOURS}
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
            <label className="backup-toggle">
              <input
                type="checkbox"
                checked={ajustes?.autoBackup !== false}
                onChange={() => void toggleAutoBackup()}
              />
              Copia automática (solo si hay cambios). Preferible con carpeta vinculada.
            </label>
            <button type="button" className="btn btn-ghost" onClick={() => void loadQuota()}>
              Ver espacio usado
            </button>
            {quota ? <p className="muted">{quota}</p> : null}
          </SettingsAccordion>
        </>
      ) : null}

      {tab === 'nombres' ? (
        <EntityCard
          title={
            <h2 className="title-sm">
              <span className="accordion-label">
                <Type size={16} />
                Nombres en la app
              </span>
            </h2>
          }
        >
          <p className="muted">
            Se respeta mayúsculas y minúsculas. Vacío + salir del campo = nombre original.
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
        </EntityCard>
      ) : null}

      {tab === 'estados' ? (
        <EntityCard
          title={
            <h2 className="title-sm">
              <span className="accordion-label">
                <CircleHelp size={16} />
                Estados de la ficha
              </span>
            </h2>
          }
        >
          <ul className="estado-help">
            <li>
              <strong>Pendiente</strong> — del mes actual y aún no ejecutada.
            </li>
            <li>
              <strong>Programada</strong> — del {label('trimestre', aliases)}, en un mes que todavía
              no llega.
            </li>
            <li>
              <strong>Planificada</strong> — más allá del {label('trimestre', aliases)}. Se ve en el
              cronograma, no en el dashboard.
            </li>
            <li>
              <strong>Vencida</strong> — la fecha ya pasó y no se ejecutó.
            </li>
            <li>
              <strong>Ejecutada</strong> — registrada como hecha.
            </li>
          </ul>
        </EntityCard>
      ) : null}

      {tab === 'acerca' ? (
        <EntityCard
          title={
            <h2 className="title-sm">
              <span className="accordion-label">
                <Info size={16} />
                Acerca de
              </span>
            </h2>
          }
        >
          <p className="muted">
            MaintManage funciona sin servidor. GitHub Pages solo entrega la aplicación. La copia
            vive en la carpeta, el ZIP o el JSON que elijas. El ZIP y la carpeta incluyen fotos; el
            JSON solo datos. Fotos y documentos grandes ocupan cuota del navegador. Word se
            almacena; la vista previa rica no está incluida. iOS comparte peor archivos que Android.
          </p>
        </EntityCard>
      ) : null}
    </div>
  )
}

function SettingsAccordion({
  title,
  icon: Icon,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string
  icon?: LucideIcon
  summary?: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <EntityCard
      className={`accordion-panel${open ? '' : ' is-collapsed'}`}
      title={
        <button
          type="button"
          className="accordion-trigger ajustes-accordion-trigger"
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
      }
    >
      {open ? children : null}
    </EntityCard>
  )
}
