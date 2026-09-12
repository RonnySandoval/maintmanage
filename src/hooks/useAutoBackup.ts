import { useCallback, useEffect, useState } from 'react'
import { runAutoBackupIfDue, saveBackupNow } from '../lib/autoBackup'

const DISMISS_KEY = 'mm-backup-banner-dismissed'

export function useAutoBackup() {
  const [banner, setBanner] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

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
    try {
      await saveBackupNow()
      sessionStorage.removeItem(DISMISS_KEY)
      setBanner(null)
    } finally {
      setBusy(false)
    }
  }, [])

  const dismiss = useCallback(() => {
    sessionStorage.setItem(DISMISS_KEY, '1')
    setBanner(null)
  }, [])

  return { banner, busy, saveNow, dismiss }
}
