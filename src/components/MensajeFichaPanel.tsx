import { useEffect, useRef, useState } from 'react'
import { Copy, MessageSquare, RotateCcw } from 'lucide-react'
import type { Bloque, Encargado, Ficha, Ocurrencia } from '../db/types'
import { formatFechaProgramada } from '../lib/dates'
import { copyText } from '../lib/share'
import {
  DEFAULT_FICHA_MESSAGE_TEMPLATE,
  FICHA_MESSAGE_STORAGE_KEY,
  FICHA_MESSAGE_TAGS,
  renderFichaMessage,
} from '../lib/messageTemplates'
import { ShareMenu } from './ShareMenu'
import { EntityCard } from './EntityCard'

const STORAGE_KEY = FICHA_MESSAGE_STORAGE_KEY

function initialTemplate(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_FICHA_MESSAGE_TEMPLATE
  } catch {
    return DEFAULT_FICHA_MESSAGE_TEMPLATE
  }
}

export function MensajeFichaPanel({
  ficha,
  encargado,
  bloque,
  ocurrencias,
}: {
  ficha: Ficha
  encargado?: Encargado
  bloque?: Bloque
  ocurrencias: Ocurrencia[]
}) {
  const [template, setTemplate] = useState(initialTemplate)
  const [ocurrenciaId, setOcurrenciaId] = useState('')
  const [copied, setCopied] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!ocurrenciaId && ocurrencias.length) {
      const next = ocurrencias.find((item) => item.fechaProgramada >= new Date().toISOString().slice(0, 10)) ?? ocurrencias[0]
      setOcurrenciaId(next.id)
    }
  }, [ocurrenciaId, ocurrencias])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, template)
    } catch {
      // La plantilla sigue funcionando aunque el almacenamiento esté bloqueado.
    }
  }, [template])

  const ocurrencia = ocurrencias.find((item) => item.id === ocurrenciaId)
  const message = renderFichaMessage(template, ficha, encargado, bloque, ocurrencia)

  function insertTag(token: string) {
    const textarea = textareaRef.current
    if (!textarea) {
      setTemplate((current) => `${current}${token}`)
      return
    }
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    setTemplate((current) => `${current.slice(0, start)}${token}${current.slice(end)}`)
    requestAnimationFrame(() => {
      textarea.focus()
      const position = start + token.length
      textarea.setSelectionRange(position, position)
    })
  }

  async function copyMessage() {
    await copyText(message)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <EntityCard
      title={
        <div className="row-spread">
          <h3 className="title-sm" style={{ margin: 0 }}>
            <MessageSquare size={17} aria-hidden /> Mensaje para la ficha
          </h3>
          <button
            type="button"
            className="icon-btn"
            title="Restaurar plantilla inicial"
            aria-label="Restaurar plantilla inicial"
            onClick={() => setTemplate(DEFAULT_FICHA_MESSAGE_TEMPLATE)}
          >
            <RotateCcw size={16} />
          </button>
        </div>
      }
    >
      <p className="muted" style={{ marginTop: 0 }}>
        Escribe una plantilla y añade etiquetas. Se guarda para reutilizarla en las demás fichas.
      </p>
      <div className="field">
        <label htmlFor="mensaje-plantilla">Plantilla</label>
        <textarea
          ref={textareaRef}
          id="mensaje-plantilla"
          className="textarea"
          rows={7}
          value={template}
          onChange={(event) => setTemplate(event.target.value)}
        />
      </div>
      <div className="chip-row tight" aria-label="Etiquetas disponibles">
        {FICHA_MESSAGE_TAGS.map((tag) => (
          <button key={tag.token} type="button" className="chip compact" onClick={() => insertTag(tag.token)}>
            {tag.label}
          </button>
        ))}
      </div>
      <div className="field" style={{ marginTop: '0.9rem' }}>
        <label htmlFor="mensaje-inspeccion">Inspección de referencia</label>
        <select
          id="mensaje-inspeccion"
          className="select"
          value={ocurrenciaId}
          onChange={(event) => setOcurrenciaId(event.target.value)}
          disabled={!ocurrencias.length}
        >
          {!ocurrencias.length ? <option value="">Sin inspecciones programadas</option> : null}
          {ocurrencias.map((item) => (
            <option key={item.id} value={item.id}>
              {formatFechaProgramada(item.fechaProgramada, ficha.fechaPrecision)}
            </option>
          ))}
        </select>
      </div>
      <div className="message-preview">
        <span className="muted message-preview-label">Vista previa</span>
        <p>{message}</p>
      </div>
      <div className="row" style={{ flexWrap: 'wrap', marginTop: '0.8rem' }}>
        <button type="button" className="btn btn-primary" onClick={() => void copyMessage()}>
          <Copy size={16} /> {copied ? 'Copiado' : 'Copiar mensaje'}
        </button>
        <ShareMenu title={`Mensaje - ${ficha.nombre}`} text={message} />
      </div>
    </EntityCard>
  )
}