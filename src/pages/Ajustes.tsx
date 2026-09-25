import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Bell,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock,
  Cloud,
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
  UploadCloud,
  X,
  type LucideIcon,
} from 'lucide-react'
import { db } from '../db'
import {
  BACKUP_FILE_NAME,
  backupKindLabel,
  backupIntervalHoursOf,
  backupIntervalMsOf,
  canUseFolderBackup,
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
  sharePreparedBackupZip,
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
import { DataProcessOverlay } from '../components/DataProcessOverlay'
import { EntityCard } from '../components/EntityCard'
import { ErrorDetail } from '../components/ErrorDetail'
import { GoogleAccountPanel } from '../components/GoogleAccountPanel'
import { ThemeModePicker } from '../components/ThemeQuickToggle'
import { useDataProcess } from '../hooks/useDataProcess'
import { useInstallPrompt } from '../hooks/useInstallPrompt'
import { useAutoBackupContext } from '../hooks/useAutoBackup'
import {
  EXPORT_STEPS,
  FOLDER_RESTORE_STEPS,
  FOLDER_WRITE_STEPS,
  IMPORT_STEPS,
  SAVE_BACKUP_STEPS,
} from '../lib/dataProcess'

type AjustesTab = 'gmail' | 'copia' | 'programa' | 'nombres' | 'avisos' | 'estados' | 'acerca'

function tabFromParam(value: string | null): AjustesTab | null {
  if (
    value === 'gmail' ||
    value === 'copia' ||
    value === 'programa' ||
    value === 'nombres' ||
    value === 'avisos' ||
    value === 'estados' ||
    value === 'acerca'
  ) {
    return value
  }
  // Sin parámetro (o 'none'): todos los acordeones cerrados por defecto.
  return null
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
  const shareZipRef = useRef<{
    buffer: ArrayBuffer
    filename: string
    size: number
    mime: string
  } | null>(null)
  const shareStampRef = useRef<number>(-1)
  const [sharePrep, setSharePrep] = useState<'idle' | 'preparing' | 'ready' | 'error'>('idle')
  const [shareWarmKey, setShareWarmKey] = useState(0)
  const { session: processSession, run: runProcess, dismiss: dismissProcess } = useDataProcess()
  const working = busy || !!processSession

  const aliases = useAliases()
  const intervalHours = backupIntervalHoursOf(ajustes?.backupIntervalHours)
  const nextBackupAt = nextBackupAtOf(ajustes)
  const pendingChanges =
    !!ajustes?.lastChangedAt &&
    (!ajustes.lastBackupAt || ajustes.lastChangedAt > ajustes.lastBackupAt)
  const { suggest, dismissSuggestion } = useAutoBackupContext()
  const hasFolder = Boolean(ajustes?.backupFolderName)
  const caminoActivo = copiaCamino === 'carpeta' && !folderOk ? 'zip' : copiaCamino
  const dataStamp = ajustes?.lastChangedAt ?? 0

  // Prepara el blob en segundo plano; el File se crea en el click (Android).
  useEffect(() => {
    if (tab !== 'copia' || copiaPaso !== 'guardar' || caminoActivo !== 'zip') return

    let cancelled = false

    async function warm() {
      if (shareZipRef.current && shareStampRef.current === dataStamp) {
        setSharePrep('ready')
        return
      }
      setSharePrep('preparing')
      try {
        const prepared = await prepareBackupZipForShare()
        if (cancelled) return
        shareZipRef.current = prepared
        shareStampRef.current = dataStamp
        setSharePrep('ready')
      } catch {
        if (!cancelled) {
          shareZipRef.current = null
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
    const prepared = shareZipRef.current
    if (!prepared || sharePrep !== 'ready') {
      setMessage(
        sharePrep === 'preparing'
          ? 'El ZIP se está preparando… espera un momento y pulsa de nuevo.'
          : 'No hay un ZIP listo. Espera a que termine la preparación o usa «Descargar ZIP».',
      )
      return
    }

    // Sin awaits previos al share: File se crea dentro de sharePreparedBackupZip.
    const outcome = await sharePreparedBackupZip(prepared)
    const result = outcome.status

    if (result === 'cancelled') {
      setMessage('')
      return
    }
    if (result === 'shared') {
      shareZipRef.current = null
      shareStampRef.current = -1
      setShareWarmKey((k) => k + 1)
      setMessage(
        'Datos compartidos (sin fotos). En el otro dispositivo restáuralos con «Elegir JSON» o eligiendo el .txt.',
      )
      return
    }
    if (result === 'needs-gesture') {
      setMessage(`El navegador perdió el gesto del toque. Detalle: ${outcome.detail}`)
      return
    }
    if (result === 'rejected') {
      setMessage(
        `No se pudo compartir. Usa «Descargar ZIP» (completo con fotos) y adjúntalo desde Descargas. Detalle: ${outcome.detail}`,
      )
      return
    }
    if (result === 'unsupported') {
      setMessage(
        `No se puede compartir este ZIP en este navegador. Usa «Descargar ZIP». Detalle: ${outcome.detail}`,
      )
      return
    }
    setMessage(`No se pudo abrir el menú de compartir. Detalle: ${outcome.detail}`)
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
    setMessage('')
    try {
      const { blob } = await runProcess<{ blob: Blob; filename: string }>({
        title: 'Exportando copia ZIP',
        steps: EXPORT_STEPS,
        successTitle: 'ZIP exportado',
        successMessage: (result) =>
          `Archivo listo (${formatBytes(result.blob.size)}). Guárdalo o compártelo con otro dispositivo.`,
        errorTitle: 'No se pudo exportar el ZIP',
        work: async (advance) => {
          advance('collect')
          advance('pack')
          const result = await exportBackupZip()
          advance('finish')
          downloadBlob(result.blob, result.filename)
          await markBackupDone('zip')
          shareZipRef.current = null
          shareStampRef.current = -1
          setShareWarmKey((k) => k + 1)
          return result
        },
      })
      setMessage(
        `ZIP listo (${formatBytes(blob.size)}). Guárdalo o pásalo al otro dispositivo e impórtalo como ZIP.`,
      )
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'No se pudo exportar el ZIP.')
    }
  }

  async function exportJson() {
    setMessage('')
    try {
      const { blob } = await runProcess<{ blob: Blob; filename: string }>({
        title: 'Exportando copia JSON',
        steps: EXPORT_STEPS,
        successTitle: 'JSON exportado',
        successMessage: (result) =>
          `Archivo listo (${formatBytes(result.blob.size)}). Solo datos, sin fotos.`,
        errorTitle: 'No se pudo exportar el JSON',
        work: async (advance) => {
          advance('collect')
          advance('pack')
          const result = await exportBackupJson()
          advance('finish')
          downloadBlob(result.blob, result.filename)
          await markBackupDone('json')
          return result
        },
      })
      setMessage(
        `JSON listo (${formatBytes(blob.size)}). Solo datos (sin fotos). Impórtalo como JSON.`,
      )
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'No se pudo exportar el JSON.')
    }
  }

  async function saveNow() {
    setMessage('')
    try {
      const result = await runProcess<{ kind: 'folder' | 'zip'; size: number }>({
        title: 'Guardando copia',
        steps: SAVE_BACKUP_STEPS,
        successTitle: 'Copia guardada',
        successMessage: (saved) =>
          saved.kind === 'folder'
            ? `Actualizado en la carpeta (${formatBytes(saved.size)}).`
            : `ZIP descargado (${formatBytes(saved.size)}).`,
        errorTitle: 'No se pudo guardar la copia',
        work: async (advance) => saveBackupNow((step) => advance(step)),
      })
      setMessage(
        result.kind === 'folder'
          ? `Actualizado en carpeta «${ajustes?.backupFolderName || 'elegida'}» (${formatBytes(result.size)}). Archivo: ${BACKUP_FILE_NAME}.`
          : `ZIP descargado (${formatBytes(result.size)}). Restáuralo con «Elegir ZIP».`,
      )
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'No se pudo guardar la copia.')
    }
  }

  async function chooseFolder() {
    setMessage('')
    try {
      await runProcess({
        title: 'Configurando carpeta de copia',
        steps: FOLDER_WRITE_STEPS,
        successTitle: 'Carpeta configurada',
        successMessage: 'La carpeta de respaldo quedó lista.',
        errorTitle: 'No se pudo elegir la carpeta',
        work: async (advance) => {
          advance('collect')
          const handle = await pickBackupFolder()
          if (await hasUserData()) {
            advance('pack')
            advance('write')
            const size = await writeBackupToFolder(handle)
            setMessage(`Carpeta «${handle.name}» lista. Copia escrita (${formatBytes(size)}).`)
          } else {
            setMessage(`Carpeta «${handle.name}» lista. Las copias se escribirán aquí automáticamente.`)
          }
        },
      })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setMessage('')
        return
      }
      setMessage(err instanceof Error ? err.message : 'No se pudo elegir la carpeta.')
    }
  }

  async function restoreFolder(modeImport: 'replace' | 'merge') {
    const ok = confirm(
      modeImport === 'replace'
        ? 'Esto REEMPLAZA todos los datos locales por los de la carpeta. ¿Continuar?'
        : 'Se fusionarán registros por identificador. ¿Continuar?',
    )
    if (!ok) return
    setMessage('')
    try {
      await runProcess({
        title: 'Restaurando desde carpeta',
        steps: FOLDER_RESTORE_STEPS,
        successTitle: 'Datos restaurados',
        successMessage:
          modeImport === 'replace'
            ? 'Los datos locales se reemplazaron por los de la carpeta.'
            : 'Los datos de la carpeta se fusionaron con los locales.',
        errorTitle: 'No se pudo restaurar',
        work: async (advance) => {
          advance('read')
          const linked = await getUsableBackupFolder()
          const handle = linked ?? (await pickBackupFolder())
          advance('validate')
          await restoreFromFolder(handle, modeImport)
          advance('apply')
          await ensureHorizon()
          setMessage(
            `Datos recuperados desde carpeta «${handle.name}» (${BACKUP_FILE_NAME} o ZIP maintmanage-*.zip).`,
          )
        },
      })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setMessage('')
        return
      }
      setMessage(err instanceof Error ? err.message : 'No se pudo restaurar desde la carpeta.')
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
    setMessage('')
    try {
      const kind = await runProcess<Awaited<ReturnType<typeof importBackup>>>({
        title: 'Importando copia',
        steps: IMPORT_STEPS,
        successTitle: 'Copia importada',
        successMessage: () =>
          modeImport === 'replace'
            ? 'Los datos del archivo reemplazaron los locales.'
            : 'Los datos del archivo se fusionaron con los locales.',
        errorTitle: 'No se pudo importar',
        work: async (advance) => {
          advance('read')
          advance('validate')
          const imported = await importBackup(file, modeImport)
          advance('apply')
          await ensureHorizon()
          return imported
        },
      })
      const extra =
        kind === 'json'
          ? ' El JSON no incluye fotos ni documentos.'
          : ' Incluye archivos del ZIP si venían en la copia.'
      setMessage(
        `Copia ${backupKindLabel(kind)} importada (${modeImport === 'replace' ? 'reemplazo' : 'fusión'}).${extra}`,
      )
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'No se pudo importar.')
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

  function setTab(next: AjustesTab | null) {
    const nextParams = new URLSearchParams(params)
    if (next) nextParams.set('tab', next)
    else nextParams.set('tab', 'none')
    setParams(nextParams, { replace: true })
  }

  function toggleSection(next: AjustesTab) {
    setTab(tab === next ? null : next)
    setMessage('')
  }

  /** Desde la card de sugerencia: abre «Copia en Google» y señala «Crear copia ahora». */
  function goToCreate() {
    setTab('gmail')
    setMessage('')
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = document.getElementById('gmail-crear-copia-btn')
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el?.classList.add('gmail-create-highlight')
        setTimeout(() => el?.classList.remove('gmail-create-highlight'), 2600)
      })
    })
  }

  return (
    <>
    <DataProcessOverlay session={processSession} onDismiss={dismissProcess} />
    <div className="stack ajustes-page">
      {suggest ? (
        <div className="ajustes-backup-suggest" role="status">
          <div
            className="ajustes-backup-suggest-card"
            role="button"
            tabIndex={0}
            onClick={goToCreate}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                goToCreate()
              }
            }}
          >
            <span className="ajustes-backup-suggest-flash" aria-hidden />
            <div className="ajustes-backup-suggest-row">
              <span className="ajustes-backup-suggest-icon" aria-hidden>
                <UploadCloud size={20} />
              </span>
              <span className="ajustes-backup-suggest-text">
                <strong>Hay cambios sin copiar todavía.</strong>
                <span>Haz una copia de respaldo segura ahora.</span>
              </span>
            </div>
            <span className="ajustes-backup-suggest-cta">
              Crear copia ahora
              <ChevronRight size={16} aria-hidden />
            </span>
            <button
              type="button"
              className="icon-btn ajustes-backup-suggest-dismiss"
              aria-label="Descartar sugerencia"
              title="Descartar esta vez"
              onClick={(event) => {
                event.stopPropagation()
                dismissSuggestion()
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      ) : null}
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

      <SettingsAccordion
        title="Copia en Google"
        icon={Cloud}
        summary="Gmail entre dispositivos"
        open={tab === 'gmail'}
        onToggle={() => toggleSection('gmail')}
      >
        <GoogleAccountPanel embedded />
      </SettingsAccordion>

      <SettingsAccordion
        title="Copia local"
        icon={DatabaseBackup}
        summary="Carpeta, ZIP o JSON"
        open={tab === 'copia'}
        onToggle={() => toggleSection('copia')}
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
                  disabled={working}
                  onClick={() => void chooseFolder()}
                >
                  <FolderOpen size={16} />
                  {hasFolder ? 'Cambiar carpeta' : 'Elegir carpeta'}
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={working || !hasFolder}
                  onClick={() => void saveNow()}
                >
                  <Download size={16} />
                  Guardar en carpeta
                </button>
                {hasFolder ? (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={working}
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
                  disabled={working}
                  onClick={() => void exportZip()}
                >
                  <Download size={16} />
                  Descargar ZIP
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={working || sharePrep === 'preparing'}
                  onClick={() => {
                    if (sharePrep === 'ready') {
                      void shareZip()
                      return
                    }
                    shareZipRef.current = null
                    shareStampRef.current = -1
                    setShareWarmKey((k) => k + 1)
                  }}
                  title="Chrome no permite compartir .zip; envía los datos (sin fotos) por WhatsApp"
                >
                  <Share2 size={16} />
                  {sharePrep === 'preparing'
                    ? 'Preparando…'
                    : sharePrep === 'ready'
                      ? 'Compartir datos'
                      : sharePrep === 'error'
                        ? 'Reintentar preparar'
                        : 'Compartir datos'}
                </button>
              </div>
            ) : null}

            {copiaPaso === 'guardar' && caminoActivo === 'zip' && sharePrep === 'ready' ? (
              <p className="muted backup-camino-hint">
                Chrome bloquea compartir archivos .zip. «Compartir datos» envía la copia sin fotos
                por WhatsApp. Para fotos usa «Descargar ZIP» y adjúntalo desde Descargas.
              </p>
            ) : null}
            {copiaPaso === 'guardar' && caminoActivo === 'zip' && sharePrep === 'preparing' ? (
              <p className="muted backup-camino-hint">Preparando datos para compartir…</p>
            ) : null}

            {copiaPaso === 'guardar' && caminoActivo === 'json' ? (
              <div className="backup-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={working}
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
                  disabled={working}
                  onClick={() => void restoreFolder('replace')}
                >
                  <Upload size={16} />
                  Restaurar carpeta (reemplazar)
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={working}
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
                    disabled={working}
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
                    disabled={working}
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
                    disabled={working}
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
                    disabled={working}
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

            {message && tab === 'copia' ? (
              <div className="hint">
                <ErrorDetail message={message} />
              </div>
            ) : null}
      </SettingsAccordion>

      <SettingsAccordion
        title="Programación automática"
        icon={Clock}
        summary="Intervalo y próxima copia"
        open={tab === 'programa'}
        onToggle={() => toggleSection('programa')}
      >
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

      <SettingsAccordion
        title="Nombres en la app"
        icon={Type}
        summary="Etiquetas y textos"
        open={tab === 'nombres'}
        onToggle={() => toggleSection('nombres')}
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
      </SettingsAccordion>

      <SettingsAccordion
        title="Avisos e instalación"
        icon={Bell}
        summary="Notificaciones y PWA"
        open={tab === 'avisos'}
        onToggle={() => toggleSection('avisos')}
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
          <div className="row card-toolbar-actions" style={{ marginTop: '0.55rem' }}>
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
          {message && tab === 'avisos' ? (
            <div className="hint">
              <ErrorDetail message={message} />
            </div>
          ) : null}
      </SettingsAccordion>

      <SettingsAccordion
        title="Estados de la ficha"
        icon={CircleHelp}
        summary="Pendiente, vencida…"
        open={tab === 'estados'}
        onToggle={() => toggleSection('estados')}
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
      </SettingsAccordion>

      <SettingsAccordion
        title="Acerca de"
        icon={Info}
        summary="Cómo funciona la app"
        open={tab === 'acerca'}
        onToggle={() => toggleSection('acerca')}
      >
          <p className="muted">
            MaintManage funciona sin servidor. GitHub Pages solo entrega la aplicación. La copia
            vive en la carpeta, el ZIP o el JSON que elijas. El ZIP y la carpeta incluyen fotos; el
            JSON solo datos. Fotos y documentos grandes ocupan cuota del navegador. Word se
            almacena; la vista previa rica no está incluida. iOS comparte peor archivos que Android.
          </p>
      </SettingsAccordion>
    </div>
    </>
  )
}

function SettingsAccordion({
  title,
  icon: Icon,
  summary,
  open,
  onToggle,
  children,
}: {
  title: string
  icon?: LucideIcon
  summary?: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <EntityCard
      className={`accordion-panel ajustes-section${open ? '' : ' is-collapsed'}`}
      title={
        <button
          type="button"
          className="accordion-trigger ajustes-accordion-trigger"
          aria-expanded={open}
          onClick={onToggle}
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
      {open ? <div className="accordion-body ajustes-accordion-body">{children}</div> : null}
    </EntityCard>
  )
}
