import { db } from '../db'
import { ensureHorizon } from '../db/occurrences'

export async function requestNotificaciones(): Promise<boolean> {
  if (!('Notification' in window)) return false
  const perm = await Notification.requestPermission()
  const ok = perm === 'granted'
  await db.ajustes.update('app', { notificaciones: ok })
  return ok
}

export async function notifyIfNeeded(): Promise<void> {
  const ajustes = await db.ajustes.get('app')
  if (!ajustes?.notificaciones) return
  if (!('Notification' in window) || Notification.permission !== 'granted') return

  await ensureHorizon()
  const today = new Date().toISOString().slice(0, 10)
  if (ajustes.lastNotifiedDate === today) return

  const vencidas = await db.ocurrencias.where('estado').equals('vencida').count()
  const pendientes = await db.ocurrencias.where('estado').equals('pendiente').count()
  if (vencidas + pendientes === 0) return

  const parts: string[] = []
  if (vencidas) parts.push(`${vencidas} vencida${vencidas === 1 ? '' : 's'}`)
  if (pendientes) parts.push(`${pendientes} pendiente${pendientes === 1 ? '' : 's'}`)

  try {
    const registration = await navigator.serviceWorker?.ready
    const body = `Tienes ${parts.join(' y ')} en el cronograma.`
    if (registration?.showNotification) {
      await registration.showNotification('MaintManage', {
        body,
        icon: './pwa-192.png',
        tag: 'maintmanage-daily',
      })
    } else {
      new Notification('MaintManage', {
        body,
        icon: './pwa-192.png',
        tag: 'maintmanage-daily',
      })
    }
    await db.ajustes.update('app', { lastNotifiedDate: today })
  } catch {
    // Notifications can fail on some browsers even after permission.
  }
}
