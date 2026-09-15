import { afterEach, describe, expect, it } from 'vitest'
import { GoogleAuth, getGoogleAuth, resetGoogleAuthForTests } from './GoogleAuth'
import { createMemoryGoogleSessionStore } from './sessionStore'
import type { GoogleIdentityApi, GoogleTokenClient, GoogleTokenResponse } from './types'

afterEach(() => {
  resetGoogleAuthForTests()
})

function mockApi(options: {
  onRequest?: () => void
  tokenFactory?: (call: number) => GoogleTokenResponse
  errorType?: string
  revoke?: (token: string) => void
}): GoogleIdentityApi {
  let call = 0
  return {
    accounts: {
      oauth2: {
        initTokenClient: (config) => {
          const client: GoogleTokenClient = {
            requestAccessToken: () => {
              call += 1
              options.onRequest?.()
              if (options.errorType) {
                config.error_callback?.({ type: options.errorType, message: 'closed' })
                return
              }
              const response =
                options.tokenFactory?.(call) ??
                ({
                  access_token: `tok-${call}`,
                  expires_in: 3600,
                  scope: 'email',
                } satisfies GoogleTokenResponse)
              config.callback(response)
            },
          }
          return client
        },
        revoke: (token, done) => {
          options.revoke?.(token)
          done?.({})
        },
      },
    },
  }
}

function authDeps(overrides: ConstructorParameters<typeof GoogleAuth>[0] = {}) {
  return {
    getClientId: () => 'client.apps.googleusercontent.com',
    sessionStore: createMemoryGoogleSessionStore(),
    fetchEmail: async () => 'usuario@gmail.com',
    now: () => 1_000_000,
    ...overrides,
  }
}

describe('GoogleAuth (Fase 3)', () => {
  it('queda unavailable sin client id', () => {
    const auth = new GoogleAuth({ getClientId: () => '', sessionStore: createMemoryGoogleSessionStore() })
    expect(auth.getSnapshot().status).toBe('unavailable')
    expect(auth.getSnapshot().configured).toBe(false)
  })

  it('connect guarda token y email (persistidos entre instancias)', async () => {
    const store = createMemoryGoogleSessionStore()
    const auth = new GoogleAuth({
      ...authDeps({ sessionStore: store }),
      loadApi: async () => mockApi({}),
    })

    await auth.connect()
    const snap = auth.getSnapshot()
    expect(snap.status).toBe('connected')
    expect(snap.email).toBe('usuario@gmail.com')
    expect(auth.getAccessToken()).toBe('tok-1')
    expect(snap.expiresAt).toBe(1_000_000 + 3600_000)
    expect(store.load()?.accessToken).toBe('tok-1')
  })

  it('restaura la sesión al crear una nueva instancia (recarga)', async () => {
    const store = createMemoryGoogleSessionStore()
    const first = new GoogleAuth({
      ...authDeps({ sessionStore: store }),
      loadApi: async () => mockApi({}),
    })
    await first.connect()

    const second = new GoogleAuth({
      ...authDeps({ sessionStore: store }),
      loadApi: async () => mockApi({}),
    })
    expect(second.getSnapshot().status).toBe('connected')
    expect(second.getSnapshot().email).toBe('usuario@gmail.com')
    expect(second.getAccessToken()).toBe('tok-1')
    expect(second.isAuthenticated()).toBe(true)
  })

  it('sesión restaurada pero expirada → status expired', () => {
    const store = createMemoryGoogleSessionStore()
    store.save({
      accessToken: 'old-tok',
      expiresAt: 1_000_000 + 30_000,
      email: 'a@b.com',
    })
    const auth = new GoogleAuth({
      ...authDeps({
        sessionStore: store,
        now: () => 1_000_000 + 30_000,
        fetchEmail: async () => 'a@b.com',
      }),
    })
    expect(auth.getSnapshot().status).toBe('expired')
    expect(auth.getSnapshot().email).toBe('a@b.com')
    expect(auth.getAccessToken()).toBeNull()
  })

  it('Caso 9: OAuth cancelado muestra error amable', async () => {
    const auth = new GoogleAuth({
      ...authDeps(),
      loadApi: async () => mockApi({ errorType: 'popup_closed_by_user' }),
      fetchEmail: async () => null,
    })

    await expect(auth.connect()).rejects.toThrow(/cancelado/i)
    expect(auth.getSnapshot().status).toBe('error')
    expect(auth.getAccessToken()).toBeNull()
  })

  it('Caso 10: token expirado deja de autenticar', async () => {
    let now = 1_000_000
    const auth = new GoogleAuth({
      ...authDeps({ now: () => now }),
      loadApi: async () => mockApi({}),
      fetchEmail: async () => 'a@b.com',
    })

    await auth.connect()
    expect(auth.isAuthenticated()).toBe(true)

    // Dentro de la ventana de skew (60s antes de expires_at).
    now = 1_000_000 + 3_600_000 - 60_000
    expect(auth.isAuthenticated()).toBe(false)
    expect(auth.getAccessToken()).toBeNull()
    expect(auth.getSnapshot().status).toBe('expired')
  })

  it('ensureAccessToken vuelve a pedir consentimiento si expiró', async () => {
    let now = 1_000_000
    let requests = 0
    const api = mockApi({
      onRequest: () => {
        requests += 1
      },
    })
    const auth = new GoogleAuth({
      ...authDeps({ now: () => now, fetchEmail: async () => 'a@b.com' }),
      loadApi: async () => api,
    })

    await auth.connect()
    expect(requests).toBe(1)
    expect(auth.getAccessToken()).toBe('tok-1')

    now = 1_000_000 + 3_600_000
    const token = await auth.ensureAccessToken()
    expect(requests).toBe(2)
    expect(token).toBe('tok-2')
  })

  it('disconnect limpia token, storage y revoca', async () => {
    const store = createMemoryGoogleSessionStore()
    const revoked: string[] = []
    const auth = new GoogleAuth({
      ...authDeps({ sessionStore: store, fetchEmail: async () => 'a@b.com' }),
      loadApi: async () =>
        mockApi({
          revoke: (t) => revoked.push(t),
        }),
    })

    await auth.connect()
    expect(store.load()).not.toBeNull()
    await auth.disconnect()
    expect(auth.getAccessToken()).toBeNull()
    expect(auth.getSnapshot().status).toBe('disconnected')
    expect(auth.getSnapshot().email).toBeNull()
    expect(store.load()).toBeNull()
    expect(revoked).toEqual(['tok-1'])
  })

  it('connect sin configuración falla con mensaje claro', async () => {
    const auth = new GoogleAuth({ getClientId: () => '', sessionStore: createMemoryGoogleSessionStore() })
    await expect(auth.connect()).rejects.toThrow(/Client ID/)
  })

  it('getSnapshot estabiliza la referencia (evita freeze en React)', () => {
    const auth = new GoogleAuth({ getClientId: () => '', sessionStore: createMemoryGoogleSessionStore() })
    const a = auth.getSnapshot()
    const b = auth.getSnapshot()
    expect(a).toBe(b)
  })

  it('refreshConfiguration pasa de unavailable a disconnected', () => {
    let clientId = ''
    const auth = new GoogleAuth({
      getClientId: () => clientId,
      sessionStore: createMemoryGoogleSessionStore(),
    })
    expect(auth.getSnapshot().status).toBe('unavailable')
    clientId = 'client.apps.googleusercontent.com'
    auth.refreshConfiguration()
    expect(auth.getSnapshot().status).toBe('disconnected')
    expect(auth.getSnapshot().configured).toBe(true)
  })
})

describe('GoogleAuth singleton', () => {
  it('getGoogleAuth reutiliza instancia', () => {
    resetGoogleAuthForTests()
    const a = getGoogleAuth()
    const b = getGoogleAuth()
    expect(a).toBe(b)
  })
})
