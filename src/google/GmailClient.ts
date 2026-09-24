export class GmailApiError extends Error {
  readonly status: number
  readonly body: string

  constructor(status: number, body: string, fallbackMessage: string) {
    super(friendlyGmailError(status, body, fallbackMessage))
    this.name = 'GmailApiError'
    this.status = status
    this.body = body
  }
}

function friendlyGmailError(status: number, body: string, fallback: string): string {
  const lower = body.toLowerCase()
  if (status === 401) return 'La sesión de Google caducó. Vuelve a conectar.'
  if (status === 403) {
    if (lower.includes('insufficient') || lower.includes('permission')) {
      return 'Faltan permisos de Google para esta acción. Desconéstate y vuelve a conectar para renovar los permisos.'
    }
    return 'Google denegó el acceso a Gmail. Revisa los permisos de la app.'
  }
  if (status === 404) return 'No se encontró esa copia en Gmail.'
  if (status === 413 || lower.includes('too large') || lower.includes('limit')) {
    return 'La copia es demasiado grande para Gmail.'
  }
  if (status === 429) return 'Demasiadas peticiones a Gmail. Espera un momento e inténtalo de nuevo.'
  if (status >= 500) return 'Gmail no respondió correctamente. Inténtalo más tarde.'
  return fallback
}

export interface GmailMessageListItem {
  id: string
  threadId?: string
}

export interface GmailMessagePartBody {
  attachmentId?: string
  size?: number
  data?: string
}

export interface GmailMessagePart {
  partId?: string
  mimeType?: string
  filename?: string
  headers?: { name: string; value: string }[]
  body?: GmailMessagePartBody
  parts?: GmailMessagePart[]
}

export interface GmailMessage {
  id: string
  threadId?: string
  snippet?: string
  payload?: GmailMessagePart
  internalDate?: string
  sizeEstimate?: number
}

type TokenGetter = () => Promise<string>

export class GmailClient {
  private readonly getAccessToken: TokenGetter
  private readonly fetchImpl: typeof fetch

  constructor(
    getAccessToken: TokenGetter,
    fetchImpl: typeof fetch = fetch.bind(globalThis),
  ) {
    this.getAccessToken = getAccessToken
    this.fetchImpl = fetchImpl
  }

  /**
   * Inserta el mensaje por el endpoint de subida multipart
   * (`/upload/...?uploadType=multipart`), que es el que respeta el límite
   * documentado de 150 MiB de `users.messages.insert`. El endpoint JSON simple
   * (`raw`) tiene topes menores no documentados y falla con copias grandes.
   */
  async insertRawMessageMultipart(
    rawBase64Url: string,
    rawMimeBytes: Uint8Array,
  ): Promise<{ id: string }> {
    const boundary = `maintmanage_boundary_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2)}`
    // `Uint8Array` por defecto es `Uint8Array<ArrayBufferLike>` (puede ser un
    // SharedArrayBuffer, que `BlobPart` no acepta). `TextEncoder` siempre
    // produce un `ArrayBuffer` real, así que el cast es seguro.
    const rawMimePart = rawMimeBytes as BlobPart
    const parts: BlobPart[] = [
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
      JSON.stringify({ raw: rawBase64Url, labelIds: ['INBOX'] }),
      `\r\n--${boundary}\r\nContent-Type: message/rfc822\r\n\r\n`,
      rawMimePart,
      `\r\n--${boundary}--\r\n`,
    ]
    const body = new Blob(parts, { type: `multipart/related; boundary=${boundary}` })
    const data = await this.request<{ id: string }>(
      'https://www.googleapis.com/upload/gmail/v1/users/me/messages?uploadType=multipart',
      {
        method: 'POST',
        headers: { 'Content-Type': body.type },
        body,
      },
      'No se pudo guardar la copia en Gmail.',
    )
    if (!data.id) throw new Error('Gmail no devolvió el identificador del mensaje.')
    return { id: data.id }
  }

  async listMessageIds(query: string, maxResults = 50): Promise<GmailMessageListItem[]> {
    const params = new URLSearchParams({
      q: query,
      maxResults: String(maxResults),
    })
    const data = await this.request<{ messages?: GmailMessageListItem[] }>(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`,
      { method: 'GET' },
      'No se pudieron listar las copias en Gmail.',
    )
    return data.messages ?? []
  }

  async getMessage(id: string, format: 'full' | 'metadata' = 'full'): Promise<GmailMessage> {
    const params = new URLSearchParams({ format })
    if (format === 'metadata') {
      params.append('metadataHeaders', 'Subject')
      params.append('metadataHeaders', 'Date')
    }
    return this.request<GmailMessage>(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?${params}`,
      { method: 'GET' },
      'No se pudo leer la copia en Gmail.',
    )
  }

  async getAttachment(messageId: string, attachmentId: string): Promise<Uint8Array> {
    const data = await this.request<{ data?: string }>(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`,
      { method: 'GET' },
      'No se pudo descargar el archivo de la copia.',
    )
    if (!data.data) throw new Error('Gmail no devolvió el adjunto de la copia.')
    const { base64UrlToBytes } = await import('./mime')
    return base64UrlToBytes(data.data)
  }

  async trashMessage(id: string): Promise<void> {
    await this.request(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}/trash`,
      { method: 'POST' },
      'No se pudo eliminar la copia en Gmail.',
    )
  }

  /** Borrado permanente e inmediato (no pasa por la papelera). */
  async deleteMessage(id: string): Promise<void> {
    await this.request(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
      'No se pudo borrar la copia en Gmail.',
    )
  }

  private async request<T>(
    url: string,
    init: RequestInit,
    fallbackMessage: string,
  ): Promise<T> {
    const token = await this.getAccessToken()
    const headers = new Headers(init.headers)
    headers.set('Authorization', `Bearer ${token}`)
    const res = await this.fetchImpl(url, { ...init, headers })
    const text = await res.text()
    if (!res.ok) throw new GmailApiError(res.status, text, fallbackMessage)
    if (!text) return {} as T
    try {
      return JSON.parse(text) as T
    } catch {
      throw new Error('Respuesta inválida de Gmail.')
    }
  }
}
