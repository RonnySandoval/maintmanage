const DEVICE_ID_KEY = 'mm-device-id'

function randomIdFragment(len = 6): string {
  const bytes = new Uint8Array(Math.ceil(len / 2))
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, len)
}

/** UUID v4-ish persistente en localStorage (no es mecanismo de seguridad). */
export function getOrCreateDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY)
    if (existing && existing.length >= 8) return existing
    const id =
      typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `dev-${Date.now().toString(36)}-${randomIdFragment(8)}`
    localStorage.setItem(DEVICE_ID_KEY, id)
    return id
  } catch {
    return `ephemeral-${randomIdFragment(12)}`
  }
}

export function detectPlatform(): string {
  if (typeof navigator === 'undefined') return 'unknown'
  const ua = navigator.userAgent
  if (/Android/i.test(ua)) return 'android'
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios'
  if (/Windows/i.test(ua)) return 'windows'
  if (/Mac OS|Macintosh/i.test(ua)) return 'mac'
  if (/Linux/i.test(ua)) return 'linux'
  return 'web'
}

/** Nombre corto y no sensible para mostrar en listas de copias. */
export function detectDeviceName(): string {
  if (typeof navigator === 'undefined') return 'Dispositivo'
  const platform = detectPlatform()
  const ua = navigator.userAgent
  let browser = 'Navegador'
  if (/Edg\//i.test(ua)) browser = 'Edge'
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = 'Chrome'
  else if (/Firefox\//i.test(ua)) browser = 'Firefox'
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari'

  if (platform === 'android') return `${browser} · Android`
  if (platform === 'ios') return `${browser} · iOS`
  if (platform === 'windows') return `${browser} · PC`
  if (platform === 'mac') return `${browser} · Mac`
  if (platform === 'linux') return `${browser} · Linux`
  return `${browser} · Web`
}
