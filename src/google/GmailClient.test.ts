import { describe, expect, it, vi } from 'vitest'
import { GmailApiError, GmailClient, GmailNetworkError } from './GmailClient'

function clientWith(fetchImpl: typeof fetch): GmailClient {
  return new GmailClient(async () => 'access-token', fetchImpl)
}

describe('GmailClient frente a fallos de red', () => {
  it('reintenta una vez y tiene éxito si el fallo de fetch es transitorio', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'msgid-1' }), { status: 200 }))

    const client = clientWith(fetchMock as unknown as typeof fetch)
    const result = await client.insertRawMessageMultipart(
      'TWFpbA',
      new Uint8Array([1, 2, 3]),
    )

    expect(result.id).toBe('msgid-1')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('lanza GmailNetworkError con mensaje en español tras agotar los reintentos', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new TypeError('Failed to fetch'))

    const client = clientWith(fetchMock as unknown as typeof fetch)
    const err = await client.listMessageIds('subject:"[MAINTMANAGE_BACKUP]"').catch((e) => e)
    expect(err).toBeInstanceOf(GmailNetworkError)
    expect((err as Error).message).toMatch(/conectar con el servidor de Gmail/i)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('no reintenta errores HTTP y los sigue traduciendo a GmailApiError', async () => {
    const fetchMock = vi.fn(
      async () => new Response('{"error":{"message":"Backend Error"}}', { status: 500 }),
    )

    const client = clientWith(fetchMock as unknown as typeof fetch)
    const promise = client.listMessageIds('subject:"[MAINTMANAGE_BACKUP]"')
    await expect(promise).rejects.toBeInstanceOf(GmailApiError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('no reintenta fallos que no son de red', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('otro fallo'))

    const client = clientWith(fetchMock as unknown as typeof fetch)
    await expect(client.listMessageIds('q')).rejects.toThrow('otro fallo')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('GmailClient subida reanudable', () => {
  it('sube por fragmentos y reinicia tras un 308', async () => {
    const total = 8 * 1024 * 1024 + 10
    const mimeBytes = new Uint8Array(total)
    const putRanges: string[] = []
    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const u = String(url)
      if (u.includes('uploadType=resumable')) {
        expect(init?.method).toBe('POST')
        expect(new Headers(init?.headers).get('X-Upload-Content-Length')).toBe(String(total))
        return new Response('{}', {
          status: 200,
          headers: {
            Location:
              'https://www.googleapis.com/upload/gmail/v1/users/me/messages?upload_id=S1',
          },
        })
      }
      expect(init?.method).toBe('PUT')
      const range = new Headers(init?.headers).get('Content-Range') ?? ''
      putRanges.push(range)
      if (putRanges.length === 1) {
        return new Response(null, { status: 308, headers: { Range: 'bytes=0-8388607' } })
      }
      return new Response(JSON.stringify({ id: 'msgid-9' }), { status: 201 })
    })

    const client = clientWith(fetchMock as unknown as typeof fetch)
    const result = await client.insertRawMessageResumable('TWFpbA', mimeBytes)
    expect(result).toEqual({ id: 'msgid-9' })
    expect(putRanges).toEqual([
      `bytes 0-8388607/${total}`,
      `bytes 8388608-${total - 1}/${total}`,
    ])
  })

  it('devuelve null cuando el navegador no expone Location por CORS', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))

    const client = clientWith(fetchMock as unknown as typeof fetch)
    await expect(
      client.insertRawMessageResumable('TWFpbA', new Uint8Array([1])),
    ).resolves.toBeNull()
  })

  it('reintenta un fragmento que falla por red', async () => {
    let calls = 0
    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      calls += 1
      const u = String(url)
      if (u.includes('uploadType=resumable')) {
        return new Response('{}', {
          status: 200,
          headers: {
            Location:
              'https://www.googleapis.com/upload/gmail/v1/users/me/messages?upload_id=S2',
          },
        })
      }
      if (calls === 2) throw new TypeError('Failed to fetch')
      expect(init?.method).toBe('PUT')
      return new Response(JSON.stringify({ id: 'msgid-1' }), { status: 201 })
    })

    const client = clientWith(fetchMock as unknown as typeof fetch)
    await expect(
      client.insertRawMessageResumable('TWFpbA', new Uint8Array([1, 2])),
    ).resolves.toEqual({ id: 'msgid-1' })
    expect(calls).toBe(3)
  })

  it('error HTTP al iniciar la sesión lanza GmailApiError', async () => {
    const fetchMock = vi.fn(async () => new Response('{"error":{}}', { status: 401 }))

    const client = clientWith(fetchMock as unknown as typeof fetch)
    await expect(
      client.insertRawMessageResumable('TWFpbA', new Uint8Array([1])),
    ).rejects.toBeInstanceOf(GmailApiError)
  })
})