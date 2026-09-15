/** Client ID de OAuth (Google Cloud → ID de cliente aplicación web).
 * Preferencia: VITE_GOOGLE_CLIENT_ID (build) → public/google-oauth.json (runtime).
 * El Client ID de una app web no es secreto; sí lo son client secrets (que no usamos).
 */
let runtimeClientId = ''
let loadPromise: Promise<void> | null = null

function envClientId(): string {
  const raw = import.meta.env.VITE_GOOGLE_CLIENT_ID
  return typeof raw === 'string' ? raw.trim() : ''
}

export function getGoogleClientId(): string {
  return envClientId() || runtimeClientId
}

export function isGoogleAuthConfigured(): boolean {
  return getGoogleClientId().length > 0
}

/** Carga `google-oauth.json` si el build no trajo VITE_GOOGLE_CLIENT_ID (p. ej. GitHub Pages). */
export function ensureGoogleClientConfig(): Promise<void> {
  if (envClientId()) return Promise.resolve()
  if (runtimeClientId) return Promise.resolve()
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    try {
      const base = import.meta.env.BASE_URL || './'
      const url = new URL('google-oauth.json', base.endsWith('/') ? base : `${base}/`)
      // Con base './', new URL relativo a la página actual.
      const href =
        base === './' || base === '.'
          ? new URL('google-oauth.json', window.location.href).href
          : url.href
      const res = await fetch(href, { cache: 'no-cache' })
      if (!res.ok) return
      const data = (await res.json()) as { clientId?: unknown }
      if (typeof data.clientId === 'string' && data.clientId.trim()) {
        runtimeClientId = data.clientId.trim()
      }
    } catch {
      // Sin archivo / sin red: se queda sin configurar.
    }
  })()

  return loadPromise
}
