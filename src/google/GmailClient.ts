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

/**
 * Fallo de red al hablar con Gmail: el `fetch` lanzó `TypeError` (sin
 * respuesta HTTP), típicamente por pérdida de conexión, corte a mitad de una
 * subida grande, o bloqueo de CORS/VPN/antipublicidad. Se distingue de
 * `GmailApiError`, que es una respuesta HTTP de error ya recibida.
 */
export class GmailNetworkError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GmailNetworkError'
  }
}

const NETWORK_RETRY_ATTEMPTS = 2
const NETWORK_RETRY_DELAY_MS = 1200

/** Tamaño de cada fragmento en la subida reanudable (8 MiB). */
const RESUMABLE_CHUNK_SIZE = 8 * 1024 * 1024
/** Reintentos extra por fragmento (los PUT por rango son idempotentes). */
const RESUMABLE_CHUNK_ATTEMPTS = 3

function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError || (err instanceof Error && err.name === 'TypeError')
}

const NETWORK_ERROR_MESSAGE =
  'No se pudo conectar con el servidor de Gmail. Comprueba tu conexión a internet, ' +
  'espera unos segundos y vuelve a intentarlo. Si tienes una VPN o un bloqueador de ' +
  'anuncios activos, desactívalos.'

/**
 * Siguiente byte a subir según la cabecera `Range` de un `308 Resume
 * Incomplete`. Si no viene expuesta (CORS), se continúa desde nuestro propio
 * final del fragmento confirmado.
 */
function parseResumeOffset(range: string | null, fallbackEnd: number): number {
  if (!range) return fallbackEnd
  const match = /bytes=0-(\d+)/.exec(range.trim())
  if (!match) return fallbackEnd
  return Number(match[1]) + 1
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

  /**
   * Subida reanudable por fragmentos (protocolo oficial de Google para
   * archivos grandes desde navegador): inicia una sesión de subida y envía el
   * mensaje en `PUT` de 8 MiB. Si un fragmento se corta por red, se reenvía
   * solo ese fragmento, sin volver a empezar.
   *
   * Devuelve `null` si el flujo resumable no es usable (p. ej. el navegador no
   * puede leer la cabecera `Location` por CORS); el llamador cae entonces al
   * endpoint multipart clásico.
   */
  async insertRawMessageResumable(
    rawBase64Url: string,
    rawMimeBytes: Uint8Array,
  ): Promise<{ id: string } | null> {
    const initUrl =
      'https://www.googleapis.com/upload/gmail/v1/users/me/messages?uploadType=resumable'
    const init = await this.authorizedFetch(initUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': 'message/rfc822',
        'X-Upload-Content-Length': String(rawMimeBytes.length),
      },
      body: JSON.stringify({ raw: rawBase64Url, labelIds: ['INBOX'] }),
    })
    const initText = await init.text()
    if (!init.ok) {
      throw new GmailApiError(init.status, initText, 'No se pudo iniciar la subida a Gmail.')
    }
    const location = init.headers.get('location')
    if (!location) return null

    const media = new Blob([rawMimeBytes as BlobPart], { type: 'message/rfc822' })
    const total = rawMimeBytes.length
    let offset = 0
    while (offset < total) {
      const end = Math.min(offset + RESUMABLE_CHUNK_SIZE, total)
      const chunk = media.slice(offset, end)
      const contentRange = `bytes ${offset}-${end - 1}/${total}`
      const res = await this.putChunkWithRetry(location, chunk, contentRange, 1)

      if (res.status === 200 || res.status === 201) {
        const text = await res.text()
        if (!text) return null
        let data: { id?: string }
        try {
          data = JSON.parse(text) as { id?: string }
        } catch {
          return null
        }
        if (!data.id) return null
        return { id: data.id }
      }

      if (res.status === 308) {
        // El servidor recibió el fragmento pero falta más; continuar desde donde
        // indica `Range` (o desde nuestro propio final si no está expuesto).
        offset = parseResumeOffset(res.headers.get('range'), end)
        continue
      }

      const text = await res.text()
      throw new GmailApiError(res.status, text, 'No se pudo guardar la copia en Gmail.')
    }
    return null
  }

  /** `PUT` de un fragmento con reintento por fallos de red transitorios. */
  private async putChunkWithRetry(
    location: string,
    chunk: Blob,
    contentRange: string,
    attempt: number,
  ): Promise<Response> {
    try {
      return await this.fetchWithRetry(
        location,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'message/rfc822', 'Content-Range': contentRange },
          body: chunk,
        },
        1,
      )
    } catch (err) {
      if (err instanceof GmailNetworkError && attempt < RESUMABLE_CHUNK_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, NETWORK_RETRY_DELAY_MS * attempt))
        return this.putChunkWithRetry(location, chunk, contentRange, attempt + 1)
      }
      throw err
    }
  }

  private async request<T>(
    url: string,
    init: RequestInit,
    fallbackMessage: string,
  ): Promise<T> {
    const res = await this.authorizedFetch(url, init)
    const text = await res.text()
    if (!res.ok) throw new GmailApiError(res.status, text, fallbackMessage)
    if (!text) return {} as T
    try {
      return JSON.parse(text) as T
    } catch {
      throw new Error('Respuesta inválida de Gmail.')
    }
  }

  /** `fetch` autorizado (Bearer token) con reintento ante fallos de red. */
  private async authorizedFetch(url: string, init: RequestInit): Promise<Response> {
    const token = await this.getAccessToken()
    const headers = new Headers(init.headers)
    headers.set('Authorization', `Bearer ${token}`)
    return this.fetchWithRetry(url, { ...init, headers }, 1)
  }

  /**
   * Ejecuta `fetch` reintentando ante fallos de red transitorios (`TypeError`,
   * el "Failed to fetch" del navegador). Un único reintento con backoff suele
   * bastar cuando cae una subida grande por datos móviles. Los errores HTTP
   * (respuesta ya recibida) no se reintentan.
   */
  private async fetchWithRetry(url: string, init: RequestInit, attempt: number): Promise<Response> {
    try {
      return await this.fetchImpl(url, init)
    } catch (err) {
      if (!isNetworkError(err) || attempt >= NETWORK_RETRY_ATTEMPTS) {
        if (isNetworkError(err)) throw new GmailNetworkError(NETWORK_ERROR_MESSAGE)
        throw err
      }
      await new Promise((resolve) => setTimeout(resolve, NETWORK_RETRY_DELAY_MS * attempt))
      return this.fetchWithRetry(url, init, attempt + 1)
    }
  }
}
