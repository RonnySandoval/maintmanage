import { afterEach, describe, expect, it } from 'vitest'
import { GoogleAuth, getGoogleAuth, resetGoogleAuthForTests } from './GoogleAuth'
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

describe('GoogleAuth (Fase 3)', () => {
  it('queda unavailable sin client id', () => {
    const auth = new GoogleAuth({ getClientId: () => '' })
    expect(auth.getSnapshot().status).toBe('unavailable')
    expect(auth.getSnapshot().configured).toBe(false)
  })

  it('connect guarda token solo en memoria y email', async () => {
    const auth = new GoogleAuth({
      getClientId: () => 'client.apps.googleusercontent.com',
      loadApi: async () => mockApi({}),
      fetchEmail: async () => 'usuario@gmail.com',
      now: () => 1_000_000,
    })

    await auth.connect()
    const snap = auth.getSnapshot()
    expect(snap.status).toBe('connected')
    expect(snap.email).toBe('usuario@gmail.com')
    expect(auth.getAccessToken()).toBe('tok-1')
    expect(snap.expiresAt).toBe(1_000_000 + 3600_000)
  })

  it('Caso 9: OAuth cancelado muestra error amable', async () => {
    const auth = new GoogleAuth({
      getClientId: () => 'client.apps.googleusercontent.com',
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
      getClientId: () => 'client.apps.googleusercontent.com',
      loadApi: async () => mockApi({}),
      fetchEmail: async () => 'a@b.com',
      now: () => now,
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
      getClientId: () => 'client.apps.googleusercontent.com',
      loadApi: async () => api,
      fetchEmail: async () => 'a@b.com',
      now: () => now,
    })

    await auth.connect()
    expect(requests).toBe(1)
    expect(auth.getAccessToken()).toBe('tok-1')

    now = 1_000_000 + 3_600_000
    const token = await auth.ensureAccessToken()
    expect(requests).toBe(2)
    expect(token).toBe('tok-2')
  })

  it('disconnect limpia token y revoca', async () => {
    const revoked: string[] = []
    const auth = new GoogleAuth({
      getClientId: () => 'client.apps.googleusercontent.com',
      loadApi: async () =>
        mockApi({
          revoke: (t) => revoked.push(t),
        }),
      fetchEmail: async () => 'a@b.com',
      now: () => 1_000_000,
    })

    await auth.connect()
    await auth.disconnect()
    expect(auth.getAccessToken()).toBeNull()
    expect(auth.getSnapshot().status).toBe('disconnected')
    expect(auth.getSnapshot().email).toBeNull()
    expect(revoked).toEqual(['tok-1'])
  })

  it('connect sin configuración falla con mensaje claro', async () => {
    const auth = new GoogleAuth({ getClientId: () => '' })
    await expect(auth.connect()).rejects.toThrow(/VITE_GOOGLE_CLIENT_ID/)
  })

  it('getSnapshot estabiliza la referencia (evita freeze en React)', () => {
    const auth = new GoogleAuth({ getClientId: () => '' })
    const a = auth.getSnapshot()
    const b = auth.getSnapshot()
    expect(a).toBe(b)
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
