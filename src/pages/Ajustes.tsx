import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Bell, Download, Monitor, Moon, Smartphone, Sun, Upload } from 'lucide-react'
import { db } from '../db'
import { downloadBlob, exportBackup, importBackup } from '../db/backup'
import { ensureHorizon } from '../db/occurrences'
import { formatBytes } from '../lib/dates'
import { requestNotificaciones } from '../lib/notifications'
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
        <h2 className="title-sm">Copia entre PC y móvil</h2>
        <p className="muted">
          Los datos viven en IndexedDB de este navegador. Exporta un ZIP y ábrelo en el otro
          dispositivo (Drive, USB, correo o WhatsApp).
        </p>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void exportNow()}>
            <Download size={16} />
            Exportar copia
          </button>
          <label className="btn">
            <Upload size={16} />
            Importar (reemplazar)
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
            Importar (fusionar)
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
          MaintManage funciona sin servidor. GitHub Pages solo entrega la aplicación. Fotos y
          documentos grandes ocupan cuota del navegador. Word se almacena; la vista previa rica no
          está incluida. iOS comparte peor archivos que Android.
        </p>
      </section>
    </div>
  )
}
