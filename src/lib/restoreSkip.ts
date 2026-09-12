const SKIP_KEY = 'mm-restore-skip'

export function isRestoreSkipped(): boolean {
  return localStorage.getItem(SKIP_KEY) === '1'
}

export function skipRestore(): void {
  localStorage.setItem(SKIP_KEY, '1')
}

export function clearRestoreSkip(): void {
  localStorage.removeItem(SKIP_KEY)
}
