import type { ThemeMode } from '../db/types'

const KEY = 'mm-theme'

export function getStoredTheme(): ThemeMode {
  const value = localStorage.getItem(KEY)
  if (value === 'light' || value === 'dark' || value === 'system') return value
  return 'system'
}

export function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function resolvedTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') return systemPrefersDark() ? 'dark' : 'light'
  return mode
}

export function applyTheme(mode: ThemeMode): 'light' | 'dark' {
  const resolved = resolvedTheme(mode)
  document.documentElement.dataset.theme = resolved
  document.documentElement.style.colorScheme = resolved
  const color = resolved === 'dark' ? '#0b1220' : '#072F63'
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', color)
  return resolved
}

export function persistTheme(mode: ThemeMode): void {
  localStorage.setItem(KEY, mode)
  applyTheme(mode)
}
