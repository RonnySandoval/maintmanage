import { describe, expect, it, vi } from 'vitest'
import { BACKUP_FORMAT_VERSION, type BackupManifest } from '../backup/types'
import {
  buildBackupSearchQuery,
  buildBackupSubject,
  GmailBackupProvider,
  messageToRemoteRef,
} from './GmailBackupProvider'
import { GmailApiError } from './GmailClient'
import { buildBackupMimeMessage, bytesToBase64Url, base64UrlToBytes } from './mime'
import type { GoogleAuth } from './GoogleAuth'

function sampleMeta(overrides?: Partial<BackupManifest>): BackupManifest {
  return {
    backupFormatVersion: BACKUP_FORMAT_VERSION,
    backupId: 'BACKUP-20260915-010203-abcdef',
    createdAt: '2026-09-15T01:02:03.000Z',
    appVersion: '0.0.0',
    schemaVersion: 10,
    payloadVersion: 1,
    deviceId: 'dev-1',
    deviceName: 'Chrome · PC',
    platform: 'windows',
    dataVersion: 42,
    checksum: 'a'.repeat(64),
    size: 1234,
    kind: 'manual',
    attachmentCount: 0,
    ...overrides,
  }
}

function mockAuth(email = 'user@gmail.com'): GoogleAuth {
  return {
    isAuthenticated: () => true,
    ensureAccessToken: async () => 'access-token',
    connect: async () => undefined,
    getSnapshot: () => ({
      status: 'connected',
      email,
      expiresAt: Date.now() + 3600_000,
      error: null,
      configured: true,
    }),
  } as unknown as GoogleAuth
}

describe('mime / encoding', () => {
  it('round-trip base64url', () => {
    const bytes = new Uint8Array([1, 2, 3, 250, 255])
    const encoded = bytesToBase64Url(bytes)
    expect(encoded).not.toMatch(/[+/=]/)
    expect([...base64UrlToBytes(encoded)]).toEqual([...bytes])
  })

  it('buildBackupMimeMessage incluye asunto y adjunto', () => {
    const mime = buildBackupMimeMessage({
      to: 'user@gmail.com',
      subject: buildBackupSubject(sampleMeta()),
      bodyText: 'hola',
      filename: 'maintmanage-BACKUP.zip',
      attachmentBytes: new Uint8Array([0x50, 0x4b]),
    })
    expect(mime).toContain('[MAINTMANAGE_BACKUP]')
    expect(mime).toContain('application/zip')
    expect(mime).toContain('filename="maintmanage-BACKUP.zip"')
  })
})

describe('GmailBackupProvider helpers', () => {
  it('buildBackupSearchQuery usa subject quoted', () => {
    expect(buildBackupSearchQuery()).toBe('subject:"[MAINTMANAGE_BACKUP]"')
  })

  it('messageToRemoteRef lee meta del cuerpo', () => {
    const meta = sampleMeta()
    const bodyJson = JSON.stringify({
      backupId: meta.backupId,
      createdAt: meta.createdAt,
      checksum: meta.checksum,
      size: meta.size,
      deviceName: meta.deviceName,
      kind: meta.kind,
    })
    // body as base64url of utf8
    const bodyB64 = bytesToBase64Url(new TextEncoder().encode(`x\nMAINTMANAGE_BACKUP_META\n${bodyJson}`))
    const ref = messageToRemoteRef({
      id: 'msg-1',
      payload: {
        headers: [{ name: 'Subject', value: buildBackupSubject(meta) }],
        parts: [
          {
            mimeType: 'text/plain',
            body: { data: bodyB64 },
          },
        ],
      },
    })
    expect(ref?.backupId).toBe(meta.backupId)
    expect(ref?.deviceName).toBe('Chrome · PC')
    expect(ref?.checksum).toBe(meta.checksum)
  })
})

describe('GmailBackupProvider API (Fase 4)', () => {
  it('createBackup inserta mensaje raw', async () => {
    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      expect(String(url)).toContain('/users/me/messages')
      expect(init?.method).toBe('POST')
      const body = JSON.parse(String(init?.body)) as { raw: string }
      expect(body.raw.length).toBeGreaterThan(10)
      return new Response(JSON.stringify({ id: 'msgid-1' }), { status: 200 })
    })

    const provider = new GmailBackupProvider(mockAuth(), fetchMock as unknown as typeof fetch)
    const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'application/zip' })
    const ref = await provider.createBackup(blob, sampleMeta({ size: 4 }))
    expect(ref.remoteId).toBe('msgid-1')
    expect(ref.backupId).toContain('BACKUP-')
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('Caso 12: rechaza backup demasiado grande', async () => {
    const provider = new GmailBackupProvider(mockAuth(), vi.fn() as unknown as typeof fetch)
    const big = new Blob([new Uint8Array(25 * 1024 * 1024)])
    await expect(provider.createBackup(big, sampleMeta({ size: big.size }))).rejects.toThrow(
      /grande|Gmail/i,
    )
  })

  it('Caso 11: error de Gmail API se traduce', async () => {
    const fetchMock = vi.fn(
      async () => new Response('{"error":{"message":"Backend Error"}}', { status: 500 }),
    )
    const provider = new GmailBackupProvider(mockAuth(), fetchMock as unknown as typeof fetch)
    await expect(
      provider.createBackup(new Blob([new Uint8Array([1])]), sampleMeta()),
    ).rejects.toBeInstanceOf(GmailApiError)
  })

  it('listBackups ordena por fecha', async () => {
    const fetchMock = vi.fn(async (url: string | URL) => {
      const u = String(url)
      if (u.includes('/messages?') && !u.includes('/messages/')) {
        return new Response(
          JSON.stringify({ messages: [{ id: 'a' }, { id: 'b' }] }),
          { status: 200 },
        )
      }
      if (u.includes('/messages/a')) {
        return new Response(
          JSON.stringify({
            id: 'a',
            payload: {
              headers: [
                {
                  name: 'Subject',
                  value: '[MAINTMANAGE_BACKUP] 2026-09-14T10:00:00.000Z BACKUP-OLD',
                },
              ],
              parts: [
                {
                  mimeType: 'text/plain',
                  body: {
                    data: bytesToBase64Url(
                      new TextEncoder().encode(
                        `MAINTMANAGE_BACKUP_META\n${JSON.stringify({
                          backupId: 'BACKUP-OLD',
                          createdAt: '2026-09-14T10:00:00.000Z',
                          size: 1,
                        })}`,
                      ),
                    ),
                  },
                },
              ],
            },
          }),
          { status: 200 },
        )
      }
      return new Response(
        JSON.stringify({
          id: 'b',
          payload: {
            headers: [
              {
                name: 'Subject',
                value: '[MAINTMANAGE_BACKUP] 2026-09-15T10:00:00.000Z BACKUP-NEW',
              },
            ],
            parts: [
              {
                mimeType: 'text/plain',
                body: {
                  data: bytesToBase64Url(
                    new TextEncoder().encode(
                      `MAINTMANAGE_BACKUP_META\n${JSON.stringify({
                        backupId: 'BACKUP-NEW',
                        createdAt: '2026-09-15T10:00:00.000Z',
                        size: 2,
                      })}`,
                    ),
                  ),
                },
              },
            ],
          },
        }),
        { status: 200 },
      )
    })

    const provider = new GmailBackupProvider(mockAuth(), fetchMock as unknown as typeof fetch)
    const list = await provider.listBackups()
    expect(list[0]?.backupId).toBe('BACKUP-NEW')
    expect(list[1]?.backupId).toBe('BACKUP-OLD')
  })

  it('downloadBackup obtiene el adjunto ZIP', async () => {
    const zipBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04])
    const fetchMock = vi.fn(async (url: string | URL) => {
      const u = String(url)
      if (u.includes('/attachments/')) {
        return new Response(JSON.stringify({ data: bytesToBase64Url(zipBytes) }), { status: 200 })
      }
      return new Response(
        JSON.stringify({
          id: 'm1',
          payload: {
            parts: [
              {
                filename: 'maintmanage-BACKUP.zip',
                mimeType: 'application/zip',
                body: { attachmentId: 'att-1', size: 4 },
              },
            ],
          },
        }),
        { status: 200 },
      )
    })

    const provider = new GmailBackupProvider(mockAuth(), fetchMock as unknown as typeof fetch)
    const blob = await provider.downloadBackup('m1')
    expect(blob.type).toBe('application/zip')
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(zipBytes)
  })

  it('deleteBackup borra permanente (DELETE, sin papelera)', async () => {
    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      expect(String(url)).toBe('https://gmail.googleapis.com/gmail/v1/users/me/messages/m1')
      expect(init?.method).toBe('DELETE')
      return new Response(null, { status: 204 })
    })
    const provider = new GmailBackupProvider(mockAuth(), fetchMock as unknown as typeof fetch)
    await provider.deleteBackup('m1')
    expect(fetchMock).toHaveBeenCalledOnce()
  })
})
