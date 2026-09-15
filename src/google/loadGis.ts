import type { GoogleIdentityApi } from './types'

const GIS_SCRIPT_ID = 'google-gsi-client'
const GIS_SRC = 'https://accounts.google.com/gsi/client'

let loading: Promise<GoogleIdentityApi> | null = null

/** Carga el script de Google Identity Services (una sola vez). */
export function loadGis(): Promise<GoogleIdentityApi> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Auth solo está disponible en el navegador.'))
  }
  if (window.google?.accounts?.oauth2) {
    return Promise.resolve(window.google)
  }
  if (loading) return loading

  loading = new Promise((resolve, reject) => {
    const existing = document.getElementById(GIS_SCRIPT_ID) as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener('load', () => {
        if (window.google?.accounts?.oauth2) resolve(window.google)
        else reject(new Error('No se pudo inicializar Google Identity Services.'))
      })
      existing.addEventListener('error', () => {
        loading = null
        reject(new Error('No se pudo cargar el acceso a Google. Comprueba la conexión.'))
      })
      return
    }

    const script = document.createElement('script')
    script.id = GIS_SCRIPT_ID
    script.src = GIS_SRC
    script.async = true
    script.onload = () => {
      if (window.google?.accounts?.oauth2) resolve(window.google)
      else {
        loading = null
        reject(new Error('No se pudo inicializar Google Identity Services.'))
      }
    }
    script.onerror = () => {
      loading = null
      reject(new Error('No se pudo cargar el acceso a Google. Comprueba la conexión.'))
    }
    document.head.appendChild(script)
  })

  return loading
}

/** Solo para pruebas. */
export function resetGisLoaderForTests(): void {
  loading = null
}
