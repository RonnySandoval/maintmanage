/** SHA-256 en hex (minúsculas) mediante Web Crypto. */
export async function sha256Hex(data: BufferSource): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data)
  return bufferToHex(digest)
}

export async function sha256HexOfBlob(blob: Blob): Promise<string> {
  return sha256Hex(await blob.arrayBuffer())
}

export async function sha256HexOfText(text: string): Promise<string> {
  return sha256Hex(new TextEncoder().encode(text))
}

/**
 * Checksum canónico del contenido del backup:
 * hash( UTF-8(backup.json) || sorted file entries: id\\0 || bytes ).
 */
export async function computeContentChecksum(
  payloadJson: string,
  files: ReadonlyArray<{ id: string; bytes: ArrayBuffer }>,
): Promise<string> {
  const encoder = new TextEncoder()
  const parts: Uint8Array[] = [encoder.encode(payloadJson)]

  const sorted = [...files].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  for (const file of sorted) {
    parts.push(encoder.encode(`${file.id}\0`))
    parts.push(new Uint8Array(file.bytes))
  }

  const merged = concatUint8(parts)
  return sha256Hex(merged.buffer as ArrayBuffer)
}

function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let out = ''
  for (let i = 0; i < bytes.length; i += 1) {
    out += bytes[i]!.toString(16).padStart(2, '0')
  }
  return out
}

function concatUint8(parts: Uint8Array[]): Uint8Array {
  let total = 0
  for (const part of parts) total += part.byteLength
  const merged = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    merged.set(part, offset)
    offset += part.byteLength
  }
  return merged
}
