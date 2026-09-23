import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  CheckSquare,
  Copy,
  Download,
  MessageSquare,
  RotateCcw,
  Sparkles,
  Square,
} from 'lucide-react'
import { db } from '../db'
import { ESTADOS, type EstadoOcurrencia, type Ficha, type Ocurrencia } from '../db/types'
import {
  DEFAULT_FICHA_MESSAGE_TEMPLATE,
  FICHA_MESSAGE_STORAGE_KEY,
  FICHA_MESSAGE_TAGS,
  renderFichaMessage,
} from '../lib/messageTemplates'
import { compareFichasByNumero, fichaTitulo } from '../lib/fichas'
import { formatFechaProgramada, monthLabel, todayISO } from '../lib/dates'
import { copyText } from '../lib/share'
import { EntityCard } from '../components/EntityCard'
import { ShareMenu } from '../components/ShareMenu'
import { StatusBadge, EmptyState } from '../components/ui'

function initialTemplate(): string {
  try {
    return localStorage.getItem(FICHA_MESSAGE_STORAGE_KEY) || DEFAULT_FICHA_MESSAGE_TEMPLATE
  } catch {
    return DEFAULT_FICHA_MESSAGE_TEMPLATE
  }
}

interface Criterio {
  template: string
  q: string
  encargadoId: string
  mes: string
  estado: EstadoOcurrencia | ''
  limite: string
}

function filtrarFichas(
  fichas: Ficha[],
  occsByFicha: Map<string, Ocurrencia[]>,
  criterio: Criterio,
  today: string,
): { fichaId: string; ocurrenciaId?: string }[] {
  const qLower = criterio.q.trim().toLowerCase()
  const rows: { fichaId: string; ocurrenciaId?: string }[] = []

  const ordenadas = fichas.slice().sort(compareFichasByNumero)
  for (const ficha of ordenadas) {
    if (criterio.encargadoId && ficha.encargadoId !== criterio.encargadoId) continue
    if (qLower && !`${ficha.numero} ${ficha.nombre}`.toLowerCase().includes(qLower)) continue
    const occs = (occsByFicha.get(ficha.id) ?? []).slice().sort((a, b) =>
      a.fechaProgramada < b.fechaProgramada ? -1 : a.fechaProgramada > b.fechaProgramada ? 1 : 0,
    )
    let ref = occs.find((o) => o.fechaProgramada >= today) ?? occs[0]
    if (criterio.mes || criterio.estado) {
      const match = occs.find(
        (o) =>
          (!criterio.mes || o.fechaProgramada.slice(0, 7) === criterio.mes) &&
          (!criterio.estado || o.estado === criterio.estado),
      )
      if (!match) continue
      ref = match
    }
    rows.push({ fichaId: ficha.id, ocurrenciaId: ref?.id })
  }

  const max = Number.parseInt(criterio.limite, 10)
  if (Number.isFinite(max) && max > 0) return rows.slice(0, max)
  return rows
}

export function MensajesPage() {
  const [template, setTemplate] = useState(initialTemplate)
  const [q, setQ] = useState('')
  const [encargadoId, setEncargadoId] = useState('')
  const [mes, setMes] = useState('')
  const [estado, setEstado] = useState<EstadoOcurrencia | ''>('')
  const [limite, setLimite] = useState('')
  /** Criterio aceptado por el usuario. null = aún no se ha generado nada. */
  const [applied, setApplied] = useState<Criterio | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [copiedAll, setCopiedAll] = useState(false)
  const [copiedId, setCopiedId] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const fichas = useLiveQuery(() => db.fichas.toArray()) ?? []
  const encargados = useLiveQuery(() => db.encargados.orderBy('nombre').toArray()) ?? []
  const bloques = useLiveQuery(() => db.grupos.orderBy('nombre').toArray()) ?? []
  const ocurrencias = useLiveQuery(() => db.ocurrencias.orderBy('fechaProgramada').toArray()) ?? []

  useEffect(() => {
    try {
      localStorage.setItem(FICHA_MESSAGE_STORAGE_KEY, template)
    } catch {
      // La plantilla sigue funcionando aunque el almacenamiento esté bloqueado.
    }
  }, [template])

  const bloqueMap = useMemo(() => Object.fromEntries(bloques.map((b) => [b.id, b])), [bloques])
  const encargadoMap = useMemo(
    () => Object.fromEntries(encargados.map((e) => [e.id, e])),
    [encargados],
  )
  const occsByFicha = useMemo(() => {
    const map = new Map<string, typeof ocurrencias>()
    for (const occ of ocurrencias) {
      const list = map.get(occ.fichaId) ?? []
      list.push(occ)
      map.set(occ.fichaId, list)
    }
    return map
  }, [ocurrencias])

  const today = todayISO()

  const borrador: Criterio = { template, q, encargadoId, mes, estado, limite }
  /** true si el borrador cambió después de la última generación aceptada. */
  const dirty = applied ? JSON.stringify(applied) !== JSON.stringify(borrador) : false

  const candidatos = useMemo(
    () => (applied ? filtrarFichas(fichas, occsByFicha, applied, today) : []),
    // today es el día actual; recalcular al cambiar de día es correcto.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- today es string diario
    [applied, fichas, occsByFicha, today],
  )

  const mensajes = useMemo(() => {
    if (!applied) return []
    return candidatos.map(({ fichaId, ocurrenciaId }) => {
      const ficha = fichas.find((f) => f.id === fichaId)!
      const ocurrencia = ocurrenciaId
        ? ocurrencias.find((o) => o.id === ocurrenciaId)
        : undefined
      const encargado = ficha.encargadoId ? encargadoMap[ficha.encargadoId] : undefined
      const bloque = bloqueMap[ficha.grupoId]
      return {
        ficha,
        ocurrencia,
        encargado,
        bloque,
        texto: renderFichaMessage(applied.template, ficha, encargado, bloque, ocurrencia),
      }
    })
  }, [applied, candidatos, fichas, ocurrencias, encargadoMap, bloqueMap])

  /** El usuario acepta el borrador: recién aquí se generan los mensajes. */
  function generar() {
    const criterio: Criterio = { template, q, encargadoId, mes, estado, limite }
    const rows = filtrarFichas(fichas, occsByFicha, criterio, today)
    setApplied(criterio)
    setSelectedIds(rows.map((r) => r.fichaId))
    setCopiedAll(false)
    setCopiedId('')
  }

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const seleccionados = useMemo(
    () => mensajes.filter((m) => selectedSet.has(m.ficha.id)),
    [mensajes, selectedSet],
  )
  const allChecked = mensajes.length > 0 && seleccionados.length === mensajes.length

  function toggleOne(fichaId: string) {
    setSelectedIds((current) =>
      current.includes(fichaId) ? current.filter((id) => id !== fichaId) : [...current, fichaId],
    )
  }

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

  async function copyOne(id: string, texto: string) {
    await copyText(texto)
    setCopiedId(id)
    setTimeout(() => setCopiedId(''), 1600)
  }

  const textoSeleccionados = useMemo(
    () => seleccionados.map((m) => m.texto).join('\n\n---\n\n'),
    [seleccionados],
  )

  async function copyAll() {
    if (!textoSeleccionados) return
    await copyText(textoSeleccionados)
    setCopiedAll(true)
    setTimeout(() => setCopiedAll(false), 1600)
  }

  function downloadAll() {
    if (!textoSeleccionados || !applied) return
    const blob = new Blob([textoSeleccionados], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mensajes-${applied.mes || today.slice(0, 7)}.txt`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  function clearFilters() {
    setQ('')
    setEncargadoId('')
    setMes('')
    setEstado('')
    setLimite('')
    setApplied(null)
    setSelectedIds([])
  }

  const hasFilters = Boolean(q || encargadoId || mes || estado || limite)

  return (
    <div className="stack">
      <EntityCard
        title={
          <div className="row-spread">
            <h3 className="title-sm" style={{ margin: 0 }}>
              <MessageSquare size={17} aria-hidden /> 1 · Plantilla
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
          Escribe el texto y toca una etiqueta para insertarla donde esté el cursor. Se comparte
          con la plantilla de cada ficha.
        </p>
        <div className="field">
          <label htmlFor="mensajes-plantilla">Plantilla</label>
          <textarea
            ref={textareaRef}
            id="mensajes-plantilla"
            className="textarea"
            rows={5}
            value={template}
            onChange={(event) => setTemplate(event.target.value)}
            placeholder="Hola {{encargado}}, te escribo por la ficha {{numero_ficha}}…"
          />
        </div>
        <div className="chip-row tight" aria-label="Etiquetas disponibles">
          {FICHA_MESSAGE_TAGS.map((tag) => (
            <button
              key={tag.token}
              type="button"
              className="chip compact"
              onClick={() => insertTag(tag.token)}
              title={tag.token}
            >
              {tag.label}
            </button>
          ))}
        </div>
      </EntityCard>

      <EntityCard
        title={
          <h3 className="title-sm" style={{ margin: 0 }}>
            2 · A quién y cuántos
          </h3>
        }
      >
        <div className="ficha-form-grid">
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="mensajes-q">Buscar ficha</label>
            <input
              id="mensajes-q"
              className="input"
              type="search"
              placeholder="Nº o nombre…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="mensajes-encargado">Encargado</label>
            <select
              id="mensajes-encargado"
              className="select"
              value={encargadoId}
              onChange={(e) => setEncargadoId(e.target.value)}
            >
              <option value="">Todos</option>
              {encargados.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="mensajes-mes">Mes de inspección</label>
            <input
              id="mensajes-mes"
              className="input"
              type="month"
              value={mes}
              onChange={(e) => setMes(e.target.value)}
            />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="mensajes-estado">Estado de inspección</label>
            <select
              id="mensajes-estado"
              className="select"
              value={estado}
              onChange={(e) => setEstado(e.target.value as EstadoOcurrencia | '')}
            >
              <option value="">Todos</option>
              {ESTADOS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="mensajes-limite">Cantidad máxima</label>
            <input
              id="mensajes-limite"
              className="input"
              type="number"
              min={1}
              placeholder="Sin límite"
              value={limite}
              onChange={(e) => setLimite(e.target.value)}
            />
          </div>
          <div className="field" style={{ margin: 0, justifyContent: 'flex-end' }}>
            <span className="muted" style={{ fontSize: '0.82rem' }}>
              {applied
                ? `${mensajes.length} mensaje${mensajes.length === 1 ? '' : 's'} · ${seleccionados.length} seleccionado${seleccionados.length === 1 ? '' : 's'}`
                : 'Sin generar: ajusta y pulsa Generar mensajes.'}
            </span>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              {hasFilters ? (
                <button type="button" className="btn btn-ghost" onClick={clearFilters}>
                  Limpiar
                </button>
              ) : null}
              <button type="button" className="btn btn-primary" onClick={generar}>
                <Sparkles size={16} />{' '}
                {applied ? 'Generar de nuevo' : 'Generar mensajes'}
              </button>
            </div>
            {applied && dirty ? (
              <span className="muted" style={{ fontSize: '0.82rem' }}>
                Cambiaste la plantilla o los filtros: lo generado abajo es lo aceptado antes.
                Pulsa «Generar de nuevo» para actualizar.
              </span>
            ) : null}
          </div>
        </div>
      </EntityCard>

      <div className="row" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
        <h3 className="title-sm" style={{ margin: 0 }}>
          3 · Mensajes
        </h3>
        <span style={{ flex: 1 }} />
        {mensajes.length ? (
          <>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() =>
                setSelectedIds(allChecked ? [] : mensajes.map((m) => m.ficha.id))
              }
            >
              {allChecked ? <Square size={16} /> : <CheckSquare size={16} />}
              {allChecked ? 'Ninguno' : 'Todos'}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!seleccionados.length}
              onClick={() => void copyAll()}
            >
              <Copy size={16} /> {copiedAll ? 'Copiado' : `Copiar (${seleccionados.length})`}
            </button>
            <button
              type="button"
              className="btn"
              disabled={!seleccionados.length}
              onClick={downloadAll}
            >
              <Download size={16} /> TXT
            </button>
            <ShareMenu title="Mensajes de inspección" text={textoSeleccionados} />
          </>
        ) : null}
      </div>

      {!applied ? (
        <EmptyState
          icon={<MessageSquare size={36} />}
          title="Aún no hay mensajes"
          text="Ajusta la plantilla y los criterios arriba y pulsa «Generar mensajes». Nada se genera hasta que lo aceptes."
          action={
            <button type="button" className="btn btn-primary" onClick={generar}>
              <Sparkles size={16} /> Generar mensajes
            </button>
          }
        />
      ) : mensajes.length === 0 ? (
        <EmptyState
          icon={<MessageSquare size={36} />}
          title="Sin mensajes"
          text={
            fichas.length === 0
              ? 'Aún no hay fichas. Crea una ficha para generar mensajes.'
              : 'No hay fichas con ese criterio. Ajusta los filtros o limpia la búsqueda.'
          }
          action={
            hasFilters ? (
              <button type="button" className="btn" onClick={clearFilters}>
                Limpiar filtros
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="stack">
          {mensajes.map(({ ficha, ocurrencia, encargado, bloque, texto }) => {
            const checked = selectedSet.has(ficha.id)
            return (
              <EntityCard
                key={ficha.id}
                title={
                  <label className="row" style={{ gap: '0.6rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleOne(ficha.id)}
                      aria-label={`Incluir ${fichaTitulo(ficha)}`}
                    />
                    <Link
                      to={`/fichas/${ficha.id}`}
                      onClick={(e) => e.stopPropagation()}
                      style={{ fontWeight: 650 }}
                    >
                      {fichaTitulo(ficha)}
                    </Link>
                  </label>
                }
                badge={ocurrencia ? <StatusBadge estado={ocurrencia.estado} /> : null}
              >
                <p className="muted" style={{ marginTop: 0, fontSize: '0.82rem' }}>
                  {[encargado?.nombre ?? 'Sin encargado', bloque?.nombre ?? 'Sin bloque']
                    .filter(Boolean)
                    .join(' · ')}
                  {ocurrencia
                    ? ` · ${formatFechaProgramada(ocurrencia.fechaProgramada, ficha.fechaPrecision)}`
                    : ' · sin inspección'}
                  {applied?.mes
                    ? ` · ${monthLabel(`${applied.mes}-01`)}`
                    : ocurrencia
                      ? ` · ${monthLabel(ocurrencia.fechaProgramada)}`
                      : ''}
                </p>
                <div className="message-preview">
                  <p style={{ whiteSpace: 'pre-wrap' }}>{texto}</p>
                </div>
                <div className="row" style={{ flexWrap: 'wrap', marginTop: '0.6rem' }}>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => void copyOne(ficha.id, texto)}
                  >
                    <Copy size={16} /> {copiedId === ficha.id ? 'Copiado' : 'Copiar'}
                  </button>
                  <ShareMenu title={`Mensaje - ${ficha.nombre}`} text={texto} />
                </div>
              </EntityCard>
            )
          })}
        </div>
      )}
    </div>
  )
}
