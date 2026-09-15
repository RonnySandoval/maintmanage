/** Persistencia del access token GIS entre recargas (sin refresh token). */

export const GOOGLE_SESSION_STORAGE_KEY = 'mm-google-auth-session'

export type GoogleStoredSession = {
  accessToken: string
  expiresAt: number
  email: string | null
}

export type GoogleSessionStore = {
  load(): GoogleStoredSession | null
  save(session: GoogleStoredSession): void
  clear(): void
}

function isValidSession(value: unknown): value is GoogleStoredSession {
  if (!value || typeof value !== 'object') return false
  const s = value as Record<string, unknown>
  return (
    typeof s.accessToken === 'string' &&
    s.accessToken.length > 0 &&
    typeof s.expiresAt === 'number' &&
    Number.isFinite(s.expiresAt) &&
    (s.email === null || typeof s.email === 'string')
  )
}

export function createLocalGoogleSessionStore(
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null = typeof localStorage !==
  'undefined'
    ? localStorage
    : null,
): GoogleSessionStore {
  return {
    load() {
      if (!storage) return null
      try {
        const raw = storage.getItem(GOOGLE_SESSION_STORAGE_KEY)
        if (!raw) return null
        const parsed: unknown = JSON.parse(raw)
        return isValidSession(parsed) ? parsed : null
      } catch {
        return null
      }
    },
    save(session) {
      if (!storage) return
      try {
        storage.setItem(GOOGLE_SESSION_STORAGE_KEY, JSON.stringify(session))
      } catch {
        // Quota / modo privado: la sesión solo vive en memoria.
      }
    },
    clear() {
      if (!storage) return
      try {
        storage.removeItem(GOOGLE_SESSION_STORAGE_KEY)
      } catch {
        // ignore
      }
    },
  }
}

export function createMemoryGoogleSessionStore(): GoogleSessionStore {
  let session: GoogleStoredSession | null = null
  return {
    load: () => session,
    save: (next) => {
      session = { ...next }
    },
    clear: () => {
      session = null
    },
  }
}
