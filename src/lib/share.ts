export async function shareContent(options: {
  title: string
  text: string
  files?: File[]
}): Promise<'shared' | 'whatsapp' | 'email' | 'copied' | 'cancelled'> {
  const { title, text, files } = options
  const nav = navigator as Navigator & {
    share?: (data: ShareData) => Promise<void>
    canShare?: (data: ShareData) => boolean
  }

  if (nav.share) {
    const data: ShareData = { title, text }
    if (files?.length && nav.canShare?.({ files })) {
      data.files = files
    }
    try {
      await nav.share(data)
      return 'shared'
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
    }
  }

  return 'copied'
}

export function openWhatsApp(text: string): void {
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
}

export function openEmail(subject: string, body: string): void {
  window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

export async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text)
}

export function blobToFile(blob: Blob, nombre: string, mimeType: string): File {
  return new File([blob], nombre, { type: mimeType || blob.type })
}
