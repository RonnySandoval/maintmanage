import { useCallback, useSyncExternalStore } from 'react'
import { getGoogleAuth, type GoogleAuthSnapshot } from '../google'

export function useGoogleAuth(): GoogleAuthSnapshot & {
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  ensureAccessToken: () => Promise<string>
} {
  const auth = getGoogleAuth()

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
