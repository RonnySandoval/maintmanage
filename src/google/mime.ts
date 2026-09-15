/** Codifica bytes en Base64URL (sin padding) para el campo `raw` de Gmail. */
export function bytesToBase64Url(bytes: Uint8Array): string {
  const chunk = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
  const binary = atob(padded + pad)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i)
  return out
}

export function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  const chunk = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

/** Base64 clásico en líneas de 76 chars (MIME). */
export function bytesToBase64Mime(bytes: Uint8Array): string {
  const chunk = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  const b64 = btoa(binary)
  const lines: string[] = []
  for (let i = 0; i < b64.length; i += 76) lines.push(b64.slice(i, i + 76))
  return lines.join('\r\n')
}

export interface BackupMimeInput {
  to: string
  subject: string
  bodyText: string
  filename: string
  attachmentBytes: Uint8Array
}

/** Construye un mensaje RFC 822 multipart con adjunto ZIP. */
export function buildBackupMimeMessage(input: BackupMimeInput): string {
  const boundary = `mm_backup_${Date.now().toString(36)}`
  const attachmentB64 = bytesToBase64Mime(input.attachmentBytes)
  const safeName = input.filename.replace(/[\r\n"]/g, '_')

  return [
    `To: ${input.to}`,
    `Subject: ${input.subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    utf8ToBase64(input.bodyText),
    '',
    `--${boundary}`,
    'Content-Type: application/zip',
    `Content-Disposition: attachment; filename="${safeName}"`,
    'Content-Transfer-Encoding: base64',
    '',
    attachmentB64,
    '',
    `--${boundary}--`,
    '',
  ].join('\r\n')
}
