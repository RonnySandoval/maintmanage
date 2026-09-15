import { useCallback, useEffect, useState } from 'react'
import { runAutoBackupIfDue, saveBackupNow } from '../lib/autoBackup'
import { SAVE_BACKUP_STEPS } from '../lib/dataProcess'
import type { DataProcessState } from '../lib/dataProcess'

const DISMISS_KEY = 'mm-backup-banner-dismissed'

export function useAutoBackup() {
  const [banner, setBanner] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [process, setProcess] = useState<DataProcessState | null>(null)

  const run = useCallback(async () => {
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
    void run()
    const onVis = () => {
      if (document.visibilityState === 'visible') void run()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [run])

  const saveNow = useCallback(async () => {
    setBusy(true)
    setProcess({
      title: 'Guardando copia',
      steps: SAVE_BACKUP_STEPS,
      activeStepId: 'collect',
    })
    try {
      await saveBackupNow((step) => {
        setProcess((prev) => (prev ? { ...prev, activeStepId: step } : null))
      })
      sessionStorage.removeItem(DISMISS_KEY)
      setBanner(null)
    } finally {
      setProcess(null)
      setBusy(false)
    }
  }, [])

  const dismiss = useCallback(() => {
    sessionStorage.setItem(DISMISS_KEY, '1')
    setBanner(null)
  }, [])

  return { banner, busy, saveNow, dismiss, process }
}
