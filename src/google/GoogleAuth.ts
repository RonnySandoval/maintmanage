import { getGoogleClientId, isGoogleAuthConfigured } from './config'
import { loadGis } from './loadGis'
import {
  GOOGLE_BACKUP_SCOPES,
  type GoogleAuthSnapshot,
  type GoogleAuthStatus,
  type GoogleIdentityApi,
  type GoogleTokenClient,
  type GoogleTokenResponse,
} from './types'

export type GoogleAuthDeps = {
  getClientId?: () => string
  loadApi?: () => Promise<GoogleIdentityApi>
  fetchEmail?: (accessToken: string) => Promise<string | null>
  now?: () => number
}

const DEFAULT_SKEW_MS = 60_000

async function defaultFetchEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return null
    const data = (await res.json()) as { email?: string }
    return typeof data.email === 'string' && data.email ? data.email : null
  } catch {
    return null
  }
}

function friendlyAuthError(code?: string, description?: string): string {
  const c = (code ?? '').toLowerCase()
  if (c === 'popup_closed_by_user' || c === 'popup_closed') {
    return 'Has cancelado el acceso a Google.'
  }
  if (c === 'access_denied') {
    return 'No se concedieron los permisos necesarios de Google.'
  }
  if (c === 'immediate_failed') {
    return 'Necesitas iniciar sesión en Google para continuar.'
  }
  if (description?.trim()) return description.trim()
  return 'No se pudo conectar con Google.'
}

/**
 * Autenticación Google (GIS Token model) sin servidor ni refresh token.
 * El access token vive solo en memoria.
 */
export class GoogleAuth {
  private status: GoogleAuthStatus = 'disconnected'
  private email: string | null = null
  private accessToken: string | null = null
  private expiresAt: number | null = null
  private error: string | null = null
  private listeners = new Set<() => void>()
  private tokenClient: GoogleTokenClient | null = null
  private cachedSnapshot: GoogleAuthSnapshot | null = null
  private readonly deps: Required<GoogleAuthDeps>

  constructor(deps: GoogleAuthDeps = {}) {
    this.deps = {
      getClientId: deps.getClientId ?? getGoogleClientId,
      loadApi: deps.loadApi ?? loadGis,
      fetchEmail: deps.fetchEmail ?? defaultFetchEmail,
      now: deps.now ?? (() => Date.now()),
    }
    if (!this.deps.getClientId()) {
      this.status = 'unavailable'
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Tras cargar clientId en runtime (p. ej. google-oauth.json en Pages). */
  refreshConfiguration(): void {
    if (this.deps.getClientId()) {
      if (this.status === 'unavailable') {
        this.setState({ status: 'disconnected', error: null })
      } else {
        this.cachedSnapshot = null
        for (const listener of this.listeners) listener()
      }
    } else if (this.status !== 'unavailable') {
      this.clearToken({ status: 'unavailable', error: null })
    }
  }

  /**
   * Debe devolver la misma referencia si no hay cambios
   * (useSyncExternalStore hace Object.is y un objeto nuevo congela la UI).
   */
  getSnapshot(): GoogleAuthSnapshot {
    const next = this.buildSnapshot()
    const prev = this.cachedSnapshot
    if (
      prev &&
      prev.status === next.status &&
      prev.email === next.email &&
      prev.expiresAt === next.expiresAt &&
      prev.error === next.error &&
      prev.configured === next.configured
    ) {
      return prev
    }
    this.cachedSnapshot = next
    return next
  }

  private buildSnapshot(): GoogleAuthSnapshot {
    const configured = this.deps.getClientId().length > 0
    let status = this.status
    if (!configured) status = 'unavailable'
    else if (this.accessToken && this.isTokenExpired()) status = 'expired'

    return {
      status,
      email: this.email,
      expiresAt: this.expiresAt,
      error: this.error,
      configured,
    }
  }

  isAuthenticated(): boolean {
    return Boolean(this.accessToken) && !this.isTokenExpired()
  }

  /** Access token en memoria, o null si no hay / expiró. */
  getAccessToken(): string | null {
    if (!this.accessToken || this.isTokenExpired()) return null
    return this.accessToken
  }

  /**
   * Devuelve un token válido. Si expiró o no hay, pide consentimiento (requiere gesto de usuario).
   */
  async ensureAccessToken(): Promise<string> {
    const current = this.getAccessToken()
    if (current) return current
    await this.connect()
    const next = this.getAccessToken()
    if (!next) throw new Error(this.error ?? 'No se pudo obtener acceso a Google.')
    return next
  }

  async connect(): Promise<void> {
    const clientId = this.deps.getClientId()
    if (!clientId) {
      this.setState({
        status: 'unavailable',
        error: 'Falta configurar el Client ID de Google para usar la copia en la nube.',
      })
      throw new Error(this.error!)
    }

    this.setState({ status: 'connecting', error: null })

    try {
      const api = await this.deps.loadApi()
      await new Promise<void>((resolve, reject) => {
        let settled = false
        const finish = (fn: () => void) => {
          if (settled) return
          settled = true
          fn()
        }

        this.tokenClient = api.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: GOOGLE_BACKUP_SCOPES,
          callback: (response) => {
            void this.handleTokenResponse(response).then(
              () => finish(resolve),
              (err) =>
                finish(() =>
                  reject(err instanceof Error ? err : new Error(String(err))),
                ),
            )
          },
          error_callback: (err) => {
            const message = friendlyAuthError(err.type, err.message)
            this.clearToken({ status: 'error', error: message })
            finish(() => reject(new Error(message)))
          },
        })

        this.tokenClient.requestAccessToken({
          prompt: this.isAuthenticated() ? '' : 'consent',
        })
      })
    } catch (err) {
      if (this.status === 'connecting') {
        const message =
          err instanceof Error ? err.message : 'No se pudo conectar con Google.'
        this.clearToken({ status: 'error', error: message })
      }
      throw err instanceof Error ? err : new Error(String(err))
    }
  }

  async disconnect(): Promise<void> {
    const token = this.accessToken
    this.clearToken({ status: 'disconnected', error: null })
    if (!token) return
    try {
      const api = await this.deps.loadApi()
      await new Promise<void>((resolve) => {
        api.accounts.oauth2.revoke(token, () => resolve())
        // Si revoke no llama back, no bloquear.
        setTimeout(() => resolve(), 1500)
      })
    } catch {
      // Ya limpiamos el estado local.
    }
  }

  private async handleTokenResponse(response: GoogleTokenResponse): Promise<void> {
    if (response.error || !response.access_token) {
      const message = friendlyAuthError(response.error, response.error_description)
      this.clearToken({ status: 'error', error: message })
      throw new Error(message)
    }

    const expiresInSec =
      typeof response.expires_in === 'number' && response.expires_in > 0
        ? response.expires_in
        : 3600
    const expiresAt = this.deps.now() + expiresInSec * 1000
    const email = (await this.deps.fetchEmail(response.access_token)) ?? this.email

    this.accessToken = response.access_token
    this.expiresAt = expiresAt
    this.email = email
    this.setState({ status: 'connected', error: null })
  }

  private isTokenExpired(): boolean {
    if (!this.expiresAt) return true
    return this.deps.now() >= this.expiresAt - DEFAULT_SKEW_MS
  }

  private clearToken(partial: { status: GoogleAuthStatus; error: string | null }): void {
    this.accessToken = null
    this.expiresAt = null
    if (partial.status === 'disconnected' || partial.status === 'unavailable') {
      this.email = null
    }
    this.setState(partial)
  }

  private setState(partial: { status?: GoogleAuthStatus; error?: string | null }): void {
    if (partial.status !== undefined) this.status = partial.status
    if (partial.error !== undefined) this.error = partial.error
    this.cachedSnapshot = null
    for (const listener of this.listeners) listener()
  }
}

let singleton: GoogleAuth | null = null

export function getGoogleAuth(): GoogleAuth {
  if (!singleton) singleton = new GoogleAuth()
  return singleton
}

/** Solo para pruebas. */
export function resetGoogleAuthForTests(instance?: GoogleAuth): void {
  singleton = instance ?? null
}

export { isGoogleAuthConfigured }
