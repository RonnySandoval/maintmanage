import {
  GMAIL_BACKUP_SUBJECT_TAG,
  type BackupManifest,
} from '../backup'
import type { BackupProvider, RemoteBackupRef } from '../backup/provider'
import {
  assessBackupSize,
  assessEncodedMessageSize,
  formatBackupSize,
  GMAIL_API_UPLOAD_MAX_BYTES,
  GMAIL_WARN_BYTES,
} from '../backup/limits'
import { getGoogleAuth } from './GoogleAuth'
import {
  GmailApiError,
  GmailClient,
  GmailNetworkError,
  type GmailMessage,
  type GmailMessagePart,
} from './GmailClient'
import { buildBackupMimeMessage, bytesToBase64Url } from './mime'

const META_MARKER = 'MAINTMANAGE_BACKUP_META'

export function buildBackupSubject(meta: BackupManifest): string {
  return `${GMAIL_BACKUP_SUBJECT_TAG} ${meta.createdAt} ${meta.backupId}`
}

export function buildBackupSearchQuery(): string {
  return `subject:"${GMAIL_BACKUP_SUBJECT_TAG}"`
}

function buildBodyText(meta: BackupManifest): string {
  return [
    'Copia de seguridad de MaintManage.',
    'No borres este mensaje si quieres restaurar en otro dispositivo.',
    '',
    META_MARKER,
    JSON.stringify({
      backupId: meta.backupId,
      createdAt: meta.createdAt,
      checksum: meta.checksum,
      size: meta.size,
      deviceName: meta.deviceName,
      deviceId: meta.deviceId,
      platform: meta.platform,
      kind: meta.kind,
      appVersion: meta.appVersion,
      schemaVersion: meta.schemaVersion,
      attachmentCount: meta.attachmentCount,
      dataVersion: meta.dataVersion,
    }),
  ].join('\n')
}

function headerValue(part: GmailMessagePart | undefined, name: string): string {
  const found = part?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())
  return found?.value ?? ''
}

function findZipPart(part: GmailMessagePart | undefined): GmailMessagePart | null {
  if (!part) return null
  const filename = part.filename ?? ''
  if (
    part.body?.attachmentId &&
    (filename.toLowerCase().endsWith('.zip') || part.mimeType === 'application/zip')
  ) {
    return part
  }
  for (const child of part.parts ?? []) {
    const found = findZipPart(child)
    if (found) return found
  }
  // Fallback: primer adjunto con attachmentId
  if (part.body?.attachmentId && filename) return part
  for (const child of part.parts ?? []) {
    if (child.body?.attachmentId) return child
  }
  return null
}

function decodeBodyData(part: GmailMessagePart | undefined): string {
  const data = part?.body?.data
  if (!data) {
    for (const child of part?.parts ?? []) {
      if (child.mimeType?.startsWith('text/plain') && child.body?.data) {
        return decodeUriBase64(child.body.data)
      }
      const nested = decodeBodyData(child)
      if (nested) return nested
    }
    return ''
  }
  return decodeUriBase64(data)
}

function decodeUriBase64(data: string): string {
  const padded = data.replace(/-/g, '+').replace(/_/g, '/')
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
  try {
    return decodeURIComponent(
      Array.from(atob(padded + pad), (c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`).join(
        '',
      ),
    )
  } catch {
    try {
      return atob(padded + pad)
    } catch {
      return ''
    }
  }
}

function parseMetaFromBody(body: string): Partial<RemoteBackupRef> {
  const idx = body.indexOf(META_MARKER)
  if (idx < 0) return {}
  const jsonStart = body.indexOf('{', idx)
  if (jsonStart < 0) return {}
  let depth = 0
  let end = -1
  for (let i = jsonStart; i < body.length; i += 1) {
    const ch = body[i]
    if (ch === '{') depth += 1
    else if (ch === '}') {
      depth -= 1
      if (depth === 0) {
        end = i + 1
        break
      }
    }
  }
  if (end < 0) return {}
  try {
    const raw = JSON.parse(body.slice(jsonStart, end)) as Record<string, unknown>
    return {
      backupId: typeof raw.backupId === 'string' ? raw.backupId : undefined,
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : undefined,
      checksum: typeof raw.checksum === 'string' ? raw.checksum : undefined,
      size: typeof raw.size === 'number' ? raw.size : undefined,
      deviceName: typeof raw.deviceName === 'string' ? raw.deviceName : undefined,
      deviceId: typeof raw.deviceId === 'string' ? raw.deviceId : undefined,
      platform: typeof raw.platform === 'string' ? raw.platform : undefined,
      kind: raw.kind === 'auto' || raw.kind === 'manual' ? raw.kind : undefined,
    }
  } catch {
    return {}
  }
}

function parseSubjectFallback(subject: string): Partial<RemoteBackupRef> {
  const tag = GMAIL_BACKUP_SUBJECT_TAG
  if (!subject.includes(tag)) return {}
  const rest = subject.slice(subject.indexOf(tag) + tag.length).trim()
  const parts = rest.split(/\s+/)
  const createdAt = parts[0]
  const backupId = parts.find((p) => p.startsWith('BACKUP-'))
  return {
    createdAt: createdAt && !Number.isNaN(Date.parse(createdAt)) ? createdAt : undefined,
    backupId,
  }
}

export function messageToRemoteRef(message: GmailMessage): RemoteBackupRef | null {
  const subject = headerValue(message.payload, 'Subject') || message.snippet || ''
  if (!subject.includes(GMAIL_BACKUP_SUBJECT_TAG)) {
    // list query should filter, but be safe
    if (!message.snippet?.includes('MaintManage') && !subject.includes('BACKUP-')) return null
  }
  const body = decodeBodyData(message.payload)
  const fromBody = parseMetaFromBody(body)
  const fromSubject = parseSubjectFallback(subject)
  const backupId = fromBody.backupId ?? fromSubject.backupId ?? `gmail-${message.id}`
  const createdAt =
    fromBody.createdAt ??
    fromSubject.createdAt ??
    (message.internalDate
      ? new Date(Number(message.internalDate)).toISOString()
      : new Date().toISOString())

  return {
    remoteId: message.id,
    backupId,
    createdAt,
    size: fromBody.size ?? message.sizeEstimate ?? 0,
    checksum: fromBody.checksum,
    deviceName: fromBody.deviceName,
    deviceId: fromBody.deviceId,
    platform: fromBody.platform,
    kind: fromBody.kind,
    subject,
  }
}

export class GmailBackupProvider implements BackupProvider {
  private readonly client: GmailClient
  private readonly auth: ReturnType<typeof getGoogleAuth>

  constructor(
    auth: ReturnType<typeof getGoogleAuth> = getGoogleAuth(),
    fetchImpl: typeof fetch = fetch.bind(globalThis),
  ) {
    this.auth = auth
    this.client = new GmailClient(() => this.auth.ensureAccessToken(), fetchImpl)
  }

  async authenticate(): Promise<void> {
    await this.auth.connect()
  }

  isAuthenticated(): boolean {
    return this.auth.isAuthenticated()
  }

  async createBackup(blob: Blob, meta: BackupManifest): Promise<RemoteBackupRef> {
    const sizeCheck = assessBackupSize(blob.size)
    if (sizeCheck.status === 'too_large') {
      throw new Error(sizeCheck.message ?? 'La copia es demasiado grande para Gmail.')
    }

    const email = this.auth.getSnapshot().email
    if (!email) {
      await this.auth.ensureAccessToken()
    }
    const to = this.auth.getSnapshot().email ?? 'me'

    const bytes = new Uint8Array(await blob.arrayBuffer())
    const subject = buildBackupSubject(meta)
    const mime = buildBackupMimeMessage({
      to,
      subject,
      bodyText: buildBodyText(meta),
      filename: `maintmanage-${meta.backupId}.zip`,
      attachmentBytes: bytes,
    })
    const mimeBytes = new TextEncoder().encode(mime)

    // El límite real de la API se aplica al mensaje RFC 822 ya codificado
    // (base64 + CRLF). El `raw` no puede excederlo, así que lo verificamos aquí.
    const encodedCheck = assessEncodedMessageSize(mimeBytes.byteLength)
    if (encodedCheck.status === 'too_large') {
      throw new Error(
        encodedCheck.message ??
          `La copia codificada (${formatBackupSize(mimeBytes.byteLength)}) supera el máximo de Gmail (${formatBackupSize(GMAIL_API_UPLOAD_MAX_BYTES)}).`,
      )
    }

    const raw = bytesToBase64Url(mimeBytes)

    // Subida reanudable primero (fragmentos de 8 MiB; Google la recomienda
    // para subidas desde móvil y ante caídas de red). Si no está disponible
    // (cabecera Location no expuesta por CORS) o falla, se cae al multipart
    // clásico para no empeorar el comportamiento anterior.
    let inserted: { id: string }
    let resumableAttempted = false
    try {
      const resumable = await this.client.insertRawMessageResumable(raw, mimeBytes).catch(
        () => {
          resumableAttempted = true
          return null
        },
      )
      inserted = resumable ?? (await this.client.insertRawMessageMultipart(raw, mimeBytes))
    } catch (err) {
      if (err instanceof GmailNetworkError) {
        const sizeHint =
          blob.size >= GMAIL_WARN_BYTES
            ? ` La copia pesa ${formatBackupSize(blob.size)}: si el problema continúa, prueba con WiFi o guarda una copia local en carpeta o ZIP.`
            : ''
        const modeNote = resumableAttempted
          ? 'La subida reanudable por fragmentos se intentó y falló.'
          : 'La subida reanudable por fragmentos no está disponible en este dispositivo.'
        throw new GmailNetworkError(`${err.message}${sizeHint} ${modeNote}`)
      }
      throw err
    }

    return {
      remoteId: inserted.id,
      backupId: meta.backupId,
      createdAt: meta.createdAt,
      size: meta.size || blob.size,
      checksum: meta.checksum,
      deviceName: meta.deviceName,
      deviceId: meta.deviceId,
      platform: meta.platform,
      kind: meta.kind,
      subject,
    }
  }

  async listBackups(): Promise<RemoteBackupRef[]> {
    const ids = await this.client.listMessageIds(buildBackupSearchQuery(), 40)
    const refs: RemoteBackupRef[] = []
    for (const item of ids) {
      try {
        const message = await this.client.getMessage(item.id, 'full')
        const ref = messageToRemoteRef(message)
        if (ref) refs.push(ref)
      } catch {
        // omitir mensajes ilegibles
      }
    }
    refs.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    return refs
  }

  async downloadBackup(remoteId: string): Promise<Blob> {
    const message = await this.client.getMessage(remoteId, 'full')
    const part = findZipPart(message.payload)
    if (!part?.body?.attachmentId) {
      throw new Error('Esa copia no tiene un archivo ZIP adjunto.')
    }
    const bytes = await this.client.getAttachment(remoteId, part.body.attachmentId)
    // Copia el buffer a uno nuevo tipado como ArrayBuffer (evita SharedArrayBuffer en BlobPart).
    const copy = new Uint8Array(bytes.byteLength)
    copy.set(bytes)
    return new Blob([copy.buffer], { type: 'application/zip' })
  }

  /**
   * Borra una copia de Gmail.
   * Devuelve `true` si se eliminó definitivamente, o `false` si el permiso
   * actual (`gmail.modify`) no permite el borrado permanente y la copia se
   * movió a la papelera de Gmail (Gmail la vacía sola en ~30 días).
   */
  async deleteBackup(remoteId: string): Promise<boolean> {
    try {
      // Borrado permanente: no pasa por la papelera de Gmail.
      await this.client.deleteMessage(remoteId)
      return true
    } catch (err) {
      if (err instanceof GmailApiError && err.status === 403) {
        // El token no tiene `mail.google.com`; usar como respaldo la papelera
        // (permite `gmail.modify`) para que la copia salga de la bandeja.
        await this.client.trashMessage(remoteId)
        return false
      }
      throw err
    }
  }
}

let providerSingleton: GmailBackupProvider | null = null

export function getGmailBackupProvider(): GmailBackupProvider {
  if (!providerSingleton) providerSingleton = new GmailBackupProvider()
  return providerSingleton
}

export function resetGmailBackupProviderForTests(instance?: GmailBackupProvider | null): void {
  providerSingleton = instance ?? null
}
