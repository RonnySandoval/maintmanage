import { useState } from 'react'
import { Copy, Mail, MessageCircle, Share2 } from 'lucide-react'
import { copyText, openEmail, openWhatsApp, shareContent } from '../lib/share'
import { Modal } from './ui'

export function ShareMenu({
  title,
  text,
  files,
  iconOnly = false,
  className,
}: {
  title: string
  text: string
  files?: File[]
  iconOnly?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  async function nativeShare() {
    const result = await shareContent({ title, text, files })
    if (result === 'shared') setOpen(false)
  }

  async function copy() {
    await copyText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <>
      <button
        type="button"
        className={
          iconOnly
            ? `icon-btn${className ? ` ${className}` : ''}`
            : `btn btn-share${className ? ` ${className}` : ''}`
        }
        aria-label="Compartir"
        title="Compartir"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen(true)
        }}
      >
        <Share2 size={16} />
        {iconOnly ? null : <span className="btn-label">Compartir</span>}
      </button>
      <Modal open={open} title="Compartir" onClose={() => setOpen(false)}>
        <div className="stack">
          <button type="button" className="btn btn-share" onClick={() => void nativeShare()}>
            <Share2 size={16} />
            Compartir desde el dispositivo
          </button>
          <button type="button" className="btn" onClick={() => openWhatsApp(text)}>
            <MessageCircle size={16} />
            WhatsApp
          </button>
          <button type="button" className="btn" onClick={() => openEmail(title, text)}>
            <Mail size={16} />
            Correo
          </button>
          <button type="button" className="btn" onClick={() => void copy()}>
            <Copy size={16} />
            {copied ? 'Copiado' : 'Copiar texto'}
          </button>
          <p className="muted">
            WhatsApp y el correo envían el resumen en texto. Los archivos se adjuntan si el
            dispositivo lo permite (compartir nativo).
          </p>
        </div>
      </Modal>
    </>
  )
}
