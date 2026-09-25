import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { checkAutoBackup, runAutoBackupNow, type SaveBackupProgress } from '../lib/autoBackup'

/** 1 h hasta el reintento tras «Aplazar» o «Cancelar». */
const RETRY_AFTER_MS = 60 * 60 * 1000

/** Ocultar la sugerencia manual durante esta sesión. */
const DISMISS_KEY = 'mm-backup-suggest-dismissed'

export type AutoBackupBarState =
  | { kind: 'none' }
  | { kind: 'running'; stage: SaveBackupProgress }
  | { kind: 'done'; message: string }
  | { kind: 'postponed'; at: number }
  | { kind: 'cancelled'; at: number }
  | { kind: 'error'; message: string }

export type AutoBackupContextValue = {
  /** Hay cambios sin copiar: flash en el botón de Ajustes + card en Ajustes. */
  suggest: boolean
  /** Oculta la sugerencia manual hasta el próximo cambio de datos. */
  dismissSuggestion: () => void
  /** Barra bajo el header: en proceso, terminada, aplazada, cancelada o con error. */
  bar: AutoBackupBarState
  postpone: () => void
  cancelRun: () => void
  closeBar: () => void
}

const AutoBackupContext = createContext<AutoBackupContextValue | null>(null)

export function useAutoBackupContext(): AutoBackupContextValue {
  const value = useContext(AutoBackupContext)
  if (!value) throw new Error('useAutoBackupContext debe usarse dentro de <AutoBackupProvider>')
  return value
}

export function AutoBackupProvider({ children }: { children: ReactNode }) {
  const ajustes = useLiveQuery(() => db.ajustes.get('app'))
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(DISMISS_KEY) === '1')
  const [bar, setBar] = useState<AutoBackupBarState>({ kind: 'none' })
  const running = useRef(false)
  const interrupted = useRef(false)

  const pendingChanges =
    !!ajustes?.lastChangedAt &&
    (!ajustes.lastBackupAt || ajustes.lastChangedAt > ajustes.lastBackupAt)

  const suggest = !dismissed && pendingChanges

  const dismissSuggestion = useCallback(() => {
    sessionStorage.setItem(DISMISS_KEY, '1')
    setDismissed(true)
  }, [])

  /** Ejecuta la copia automática en segundo plano si toca ahora. */
  const runDue = useCallback(async () => {
    if (running.current) return
    const check = await checkAutoBackup()
    if (check.status !== 'due') return
    running.current = true
    interrupted.current = false
    setBar({ kind: 'running', stage: 'collect' })
    try {
      const result = await runAutoBackupNow((step) => {
        if (!interrupted.current) setBar({ kind: 'running', stage: step })
      })
      if (interrupted.current) return
      if (result.status === 'saved-folder' || result.status === 'saved-download') {
        setBar({ kind: 'done', message: result.message ?? 'Copia de seguridad actualizada.' })
      } else {
        setBar({ kind: 'error', message: result.message ?? 'No se pudo completar la copia automática.' })
      }
    } catch (err) {
      if (interrupted.current) return
      setBar({
        kind: 'error',
        message:
          err instanceof Error
            ? `No se pudo completar la copia automática: ${err.message}`
            : 'No se pudo completar la copia automática.',
      })
    } finally {
      running.current = false
    }
  }, [])

  useEffect(() => {
    void runDue()
    const onVis = () => {
      if (document.visibilityState === 'visible') void runDue()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [runDue])

  /** Aplaza: corta la atención de la barra y programa el reintento dentro de 1 h. */
  const postpone = useCallback(async () => {
    interrupted.current = true
    const at = Date.now() + RETRY_AFTER_MS
    await db.ajustes.update('app', { nextBackupAt: at })
    setBar({ kind: 'postponed', at })
  }, [])

  const cancelRun = useCallback(async () => {
    interrupted.current = true
    const at = Date.now() + RETRY_AFTER_MS
    await db.ajustes.update('app', { nextBackupAt: at })
    setBar({ kind: 'cancelled', at })
  }, [])

  const closeBar = useCallback(() => setBar({ kind: 'none' }), [])

  const value = useMemo<AutoBackupContextValue>(
    () => ({ suggest, dismissSuggestion, bar, postpone, cancelRun, closeBar }),
    [suggest, dismissSuggestion, bar, postpone, cancelRun, closeBar],
  )

  return <AutoBackupContext.Provider value={value}>{children}</AutoBackupContext.Provider>
}