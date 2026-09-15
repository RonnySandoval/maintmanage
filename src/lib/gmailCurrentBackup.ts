const STORAGE_KEY = 'mm-gmail-current-remote-id'

export function getCurrentGmailRemoteId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function setCurrentGmailRemoteId(remoteId: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, remoteId)
  } catch {
    // localStorage no disponible
  }
}

export function clearCurrentGmailRemoteId(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
