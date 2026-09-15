/** Client ID de OAuth (Google Cloud Console → Cliente de aplicación web). */
export function getGoogleClientId(): string {
  const raw = import.meta.env.VITE_GOOGLE_CLIENT_ID
  return typeof raw === 'string' ? raw.trim() : ''
}

export function isGoogleAuthConfigured(): boolean {
  return getGoogleClientId().length > 0
}
