import { BUNDLED_GOOGLE_CLIENT_ID } from './bundledClientId'

/** Client ID de OAuth (Google Cloud → ID de cliente aplicación web).
 * Orden: VITE_GOOGLE_CLIENT_ID → runtime (google-oauth.json) → embebido.
 * El Client ID de una app web no es secreto; sí lo son client secrets (que no usamos).
 */
let runtimeClientId = ''
let loadPromise: Promise<void> | null = null

function envClientId(): string {
  const raw = import.meta.env.VITE_GOOGLE_CLIENT_ID
  return typeof raw === 'string' ? raw.trim() : ''
}

function bundledClientId(): string {
  return BUNDLED_GOOGLE_CLIENT_ID.trim()
}

export function getGoogleClientId(): string {
  return envClientId() || runtimeClientId || bundledClientId()
}

export function isGoogleAuthConfigured(): boolean {
  return getGoogleClientId().length > 0
}

function resolveOauthJsonUrl(): string {
  // Con base './' en Pages (/maintmanage), document.baseURI apunta al directorio correcto.
  if (typeof document !== 'undefined' && document.baseURI) {
    return new URL('google-oauth.json', document.baseURI).href
  }
  if (typeof window !== 'undefined') {
    const path = window.location.pathname
    const dir = path.endsWith('/') ? path : path.replace(/\/[^/]*$/, '/')
    return `${window.location.origin}${dir}google-oauth.json`
  }
  return 'google-oauth.json'
}

/** Carga opcional de `google-oauth.json` (permite cambiar ID sin recompilar). */
export function ensureGoogleClientConfig(): Promise<void> {
  if (envClientId() || runtimeClientId) return Promise.resolve()
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    try {
      const res = await fetch(resolveOauthJsonUrl(), { cache: 'no-cache' })
      if (!res.ok) return
      const data = (await res.json()) as { clientId?: unknown }
      if (typeof data.clientId === 'string' && data.clientId.trim()) {
        runtimeClientId = data.clientId.trim()
      }
    } catch {
      // Usamos el ID embebido.
    }
  })()

  return loadPromise
}
