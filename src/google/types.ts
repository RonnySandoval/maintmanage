/**
 * Scopes para backup vía Gmail (Fase 4) + mostrar cuenta.
 *
 * `gmail.modify` NO permite el borrado permanente (users.messages.delete);
 * Google responde 403 "insufficient permissions". Para "Borrar para siempre"
 * hace falta el scope total `mail.google.com` (categoría "restricted" en el
 * consent screen; funciona en modo Testing con usuarios de prueba).
 *
 * Si el token en uso no tiene `mail.google.com` (sesión anterior), el borrado
 * cae a la papelera de Gmail como respaldo (ver GmailBackupProvider.deleteBackup).
 */
export const GOOGLE_BACKUP_SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://mail.google.com/',
].join(' ')

export interface GoogleTokenResponse {
  access_token?: string
  expires_in?: number
  scope?: string
  token_type?: string
  error?: string
  error_description?: string
}

export interface GoogleTokenClientConfig {
  client_id: string
  scope: string
  callback: (response: GoogleTokenResponse) => void
  error_callback?: (error: { type?: string; message?: string }) => void
  prompt?: '' | 'none' | 'consent' | 'select_account'
}

export interface GoogleTokenClient {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void
}

export interface GoogleIdentityApi {
  accounts: {
    oauth2: {
      initTokenClient: (config: GoogleTokenClientConfig) => GoogleTokenClient
      revoke: (token: string, done?: (response: unknown) => void) => void
      hasGrantedAllScopes?: (
        tokenResponse: GoogleTokenResponse,
        ...scopes: string[]
      ) => boolean
    }
  }
}

export type GoogleAuthStatus =
  | 'idle'
  | 'unavailable'
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'expired'
  | 'error'

export interface GoogleAuthSnapshot {
  status: GoogleAuthStatus
  email: string | null
  /** Epoch ms; null si no hay token. */
  expiresAt: number | null
  error: string | null
  configured: boolean
}

declare global {
  interface Window {
    google?: GoogleIdentityApi
  }
}
