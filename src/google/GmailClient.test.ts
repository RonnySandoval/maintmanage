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