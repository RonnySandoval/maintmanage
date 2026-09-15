import { useCallback, useEffect, useState } from 'react'
import { runAutoBackupIfDue, saveBackupNow } from '../lib/autoBackup'
import { SAVE_BACKUP_STEPS } from '../lib/dataProcess'
import { useDataProcess } from './useDataProcess'

const DISMISS_KEY = 'mm-backup-banner-dismissed'

export function useAutoBackup() {
  const [banner, setBanner] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const { session, run, dismiss: dismissProcess } = useDataProcess()

  const runCheck = useCallback(async () => {
    const result = await runAutoBackupIfDue()
    if (result.status === 'pending-download') {
      if (sessionStorage.getItem(DISMISS_KEY) === '1') return
      setBanner(result.message ?? 'Guarda una copia ahora.')
      return
    }
    if (result.status === 'saved-folder') {
      sessionStorage.removeItem(DISMISS_KEY)
      setBanner(null)
    }
  }, [])

  useEffect(() => {
    void runCheck()
    const onVis = () => {
      if (document.visibilityState === 'visible') void runCheck()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [runCheck])

  const saveNow = useCallback(async () => {
    setBusy(true)
    try {
      await run({
        title: 'Guardando copia',
        steps: SAVE_BACKUP_STEPS,
        successTitle: 'Copia guardada',
        successMessage: 'Los datos quedaron respaldados fuera del navegador.',
        errorTitle: 'No se pudo guardar la copia',
        work: async (advance) => {
          await saveBackupNow((step) => advance(step))
        },
      })
      sessionStorage.removeItem(DISMISS_KEY)
      setBanner(null)
    } catch {
      // El overlay ya muestra el error.
    } finally {
      setBusy(false)
    }
  }, [run])

  const dismiss = useCallback(() => {
    sessionStorage.setItem(DISMISS_KEY, '1')
    setBanner(null)
  }, [])

  return { banner, busy: busy || !!session, saveNow, dismiss, session, dismissProcess }
}
