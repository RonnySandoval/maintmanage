import { useCallback, useEffect, useSyncExternalStore } from 'react'
import {
  ensureGoogleClientConfig,
  getGoogleAuth,
  type GoogleAuthSnapshot,
} from '../google'

export function useGoogleAuth(): GoogleAuthSnapshot & {
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  ensureAccessToken: () => Promise<string>
} {
  const auth = getGoogleAuth()

  useEffect(() => {
    let cancelled = false
    void ensureGoogleClientConfig().then(() => {
      if (!cancelled) auth.refreshConfiguration()
    })
    return () => {
      cancelled = true
    }
  }, [auth])

  const snapshot = useSyncExternalStore(
    (onStoreChange) => auth.subscribe(onStoreChange),
    () => auth.getSnapshot(),
    () => auth.getSnapshot(),
  )

  const connect = useCallback(() => auth.connect(), [auth])
  const disconnect = useCallback(() => auth.disconnect(), [auth])
  const ensureAccessToken = useCallback(() => auth.ensureAccessToken(), [auth])

  return { ...snapshot, connect, disconnect, ensureAccessToken }
}
