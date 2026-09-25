import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Check,
  CheckSquare,
  ChevronDown,
  Copy,
  Download,
  MessageSquare,
  RotateCcw,
  Sparkles,
  Square,
  Trash2,
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
import { createId } from '../lib/ids'
import { EntityCard } from '../components/EntityCard'
import { MultiCheckDropdown } from '../components/MultiCheckDropdown'
import { ShareMenu } from '../components/ShareMenu'
import { TagTextarea } from '../components/TagTextarea'
import { StatusBadge, EmptyState } from '../components/ui'

function initialTemplate(): string {
  try {
    return localStorage.getItem(FICHA_MESSAGE_STORAGE_KEY) || DEFAULT_FICHA_MESSAGE_TEMPLATE
  } catch {
    return DEFAULT_FICHA_MESSAGE_TEMPLATE
  }
}

function formatCorridaFecha(ts: number): string {
  return new Date(ts).toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface Criterio {
  template: string
  q: string
  encargadoId: string
  mes: string
  estado: EstadoOcurrencia[]
  limite: string
}

/** Un mensaje ya renderizado dentro de una corrida (copia fija del momento). */
interface CorridaMensaje {
  fichaId: string
  titulo: string
  estado?: EstadoOcurrencia
  meta: string
  texto: string
}

/** Una generación aceptada: agrupa los mensajes de esa corrida. */
interface Corrida {
  id: string
  fecha: number
  mes: string
  mensajes: CorridaMensaje[]
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
    if (criterio.mes || criterio.estado.length > 0) {
      const match = occs.find(
        (o) =>
          (!criterio.mes || o.fechaProgramada.slice(0, 7) === criterio.mes) &&
          (criterio.estado.length === 0 || criterio.estado.includes(o.estado)),
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

/** Sección Mensajes dentro de la página Notas·Mensajes. Las corridas viven en memoria por sesión. */
export function MensajesSeccion() {
  const [template, setTemplate] = useState(initialTemplate)
  const [q, setQ] = useState('')
  const [encargadoId, setEncargadoId] = useState('')
  const [mes, setMes] = useState('')
  const [estado, setEstado] = useState<EstadoOcurrencia[]>([])
  const [limite, setLimite] = useState('')
  /** Corridas generadas, más reciente primero. Solo en memoria (se pierden al salir). */
  const [corridas, setCorridas] = useState<Corrida[]>([])
  /** Corridas expandidas. */
  const [openIds, setOpenIds] = useState<string[]>([])
  /** Selección por corrida (fichaId incluidos en la copia). */
  const [selectedByCorrida, setSelectedByCorrida] = useState<Record<string, string[]>>({})
  const [aviso, setAviso] = useState('')
  const [copiedAllFor, setCopiedAllFor] = useState('')
  const [copiedKey, setCopiedKey] = useState('')
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
  const hasFilters = Boolean(q || encargadoId || mes || estado.length > 0 || limite)

  /** El usuario acepta el borrador: crea una corrida nueva con los mensajes renderizados. */
  function generar() {
    const criterio: Criterio = { template, q, encargadoId, mes, estado, limite }
    const rows = filtrarFichas(fichas, occsByFicha, criterio, today)
    if (rows.length === 0) {
      setAviso(
        fichas.length === 0
          ? 'Aún no hay fichas. Crea una ficha para generar mensajes.'
          : 'Ninguna ficha coincide con ese criterio.',
      )
      return
    }
    const mensajes: CorridaMensaje[] = rows.map(({ fichaId, ocurrenciaId }) => {
      const ficha = fichas.find((f) => f.id === fichaId)!
      const ocurrencia = ocurrenciaId ? ocurrencias.find((o) => o.id === ocurrenciaId) : undefined
      const encargado = ficha.encargadoId ? encargadoMap[ficha.encargadoId] : undefined
      const bloque = bloqueMap[ficha.grupoId]
      const meta = [
        encargado?.nombre ?? 'Sin encargado',
        bloque?.nombre ?? 'Sin bloque',
        ocurrencia
          ? formatFechaProgramada(ocurrencia.fechaProgramada, ficha.fechaPrecision)
          : 'sin inspección',
        criterio.mes ? monthLabel(`${criterio.mes}-01`) : ocurrencia ? monthLabel(ocurrencia.fechaProgramada) : '',
      ]
        .filter(Boolean)
        .join(' · ')
      return {
        fichaId,
        titulo: fichaTitulo(ficha),
        estado: ocurrencia?.estado,
        meta,
        texto: renderFichaMessage(criterio.template, ficha, encargado, bloque, ocurrencia),
      }
    })
    const corrida: Corrida = { id: createId(), fecha: Date.now(), mes: criterio.mes, mensajes }
    setCorridas((current) => [corrida, ...current])
    setOpenIds((current) => [corrida.id, ...current])
    setSelectedByCorrida((current) => ({ ...current, [corrida.id]: mensajes.map((m) => m.fichaId) }))
    setAviso('')
    setCopiedAllFor('')
    setCopiedKey('')
  }

  function clearFilters() {
    setQ('')
    setEncargadoId('')
    setMes('')
    setEstado([])
    setLimite('')
    setAviso('')
  }

  function toggleCorrida(id: string) {
    setOpenIds((current) =>
      current.includes(id) ? current.filter((cid) => cid !== id) : [...current, id],
    )
  }

  function toggleOne(corridaId: string, fichaId: string) {
    setSelectedByCorrida((current) => {
      const list = current[corridaId] ?? []
      return {
        ...current,
        [corridaId]: list.includes(fichaId)
          ? list.filter((id) => id !== fichaId)
          : [...list, fichaId],
      }
    })
  }

  function toggleTodos(corrida: Corrida) {
    const all = corrida.mensajes.map((m) => m.fichaId)
    setSelectedByCorrida((current) => {
      const list = current[corrida.id] ?? []
      const allChecked = list.length === all.length && all.every((id) => list.includes(id))
      return { ...current, [corrida.id]: allChecked ? [] : all }
    })
  }

  function textoSeleccionados(corrida: Corrida): string {
    const sel = new Set(selectedByCorrida[corrida.id] ?? [])
    return corrida.mensajes
      .filter((m) => sel.has(m.fichaId))
      .map((m) => m.texto)
      .join('\n\n---\n\n')
  }

  async function copyOne(key: string, texto: string) {
    await copyText(texto)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(''), 1600)
  }

  async function copyCorrida(corrida: Corrida) {
    const texto = textoSeleccionados(corrida)
    if (!texto) return
    await copyText(texto)
    setCopiedAllFor(corrida.id)
    setTimeout(() => setCopiedAllFor(''), 1600)
  }

  function downloadCorrida(corrida: Corrida) {
    const texto = textoSeleccionados(corrida)
    if (!texto) return
    const blob = new Blob([texto], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mensajes-${corrida.mes || today.slice(0, 7)}.txt`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  function borrarCorrida(corrida: Corrida) {
    const label = formatCorridaFecha(corrida.fecha)
    const n = corrida.mensajes.length
    if (!confirm(`¿Borrar la corrida del ${label} con ${n} mensaje${n === 1 ? '' : 's'}?`)) return
    setCorridas((current) => current.filter((c) => c.id !== corrida.id))
    setOpenIds((current) => current.filter((id) => id !== corrida.id))
    setSelectedByCorrida((current) => {
      const next = { ...current }
      delete next[corrida.id]
      return next
    })
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
          Toca una etiqueta para insertarla donde esté el cursor.
        </p>
        <div className="field">
          <label htmlFor="mensajes-plantilla">Plantilla</label>
          <TagTextarea
            ref={textareaRef}
            id="mensajes-plantilla"
            value={template}
            onChange={setTemplate}
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
            <span className="field-label" id="mensajes-estado-label">
              Estado de inspección
            </span>
            <MultiCheckDropdown
              label="Estado de inspección"
              options={ESTADOS.map((s) => ({ value: s.id, label: s.label }))}
              selected={estado}
              onChange={setEstado}
            />
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
          <div className="field msg-filter-foot" style={{ margin: 0, justifyContent: 'flex-end' }}>
            <span className="muted" style={{ fontSize: '0.82rem' }}>
              {corridas.length
                ? 'Cada generación crea una corrida nueva.'
                : 'Sin corridas todavía: ajusta y pulsa Generar mensajes.'}
            </span>
            <div className="msg-form-actions">
              <button
                type="button"
                className="btn btn-ghost"
                disabled={!hasFilters}
                onClick={clearFilters}
              >
                Limpiar
              </button>
              <button type="button" className="btn btn-primary" onClick={generar}>
                <Sparkles size={16} /> Generar mensajes
              </button>
            </div>
          </div>
        </div>
      </EntityCard>

      <div className="msg-toolbar">
        <h3 className="title-sm" style={{ margin: 0 }}>
          3 · Corridas
        </h3>
        {corridas.length ? (
          <span className="muted" style={{ fontSize: '0.82rem' }}>
            {corridas.length} corrida{corridas.length === 1 ? '' : 's'} · en memoria
          </span>
        ) : null}
      </div>

      {corridas.length === 0 ? (
        <EmptyState
          icon={<MessageSquare size={36} />}
          title={aviso ? 'Sin mensajes' : 'Aún no hay corridas'}
          text={
            aviso ||
            (fichas.length === 0
              ? 'Aún no hay fichas. Crea una ficha para generar mensajes.'
              : 'Nada se genera hasta que lo aceptes. Pulsa «Generar mensajes».')
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
          {aviso ? (
            <p className="muted" style={{ margin: 0 }}>
              {aviso}
            </p>
          ) : null}
          {corridas.map((corrida) => {
            const isOpen = openIds.includes(corrida.id)
            const selSet = new Set(selectedByCorrida[corrida.id] ?? [])
            const seleccionados = corrida.mensajes.filter((m) => selSet.has(m.fichaId))
            const selCount = seleccionados.length
            const allChecked = corrida.mensajes.length > 0 && selCount === corrida.mensajes.length
            const copiedAll = copiedAllFor === corrida.id
            return (
              <EntityCard
                key={corrida.id}
                className="mensajes-msg"
                title={
                  <div className="row" style={{ gap: '0.5rem', alignItems: 'center', minWidth: 0 }}>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-expanded={isOpen}
                      aria-label={isOpen ? 'Contraer corrida' : 'Ver corrida'}
                      title={isOpen ? 'Contraer' : 'Ver corrida'}
                      onClick={() => toggleCorrida(corrida.id)}
                    >
                      <ChevronDown
                        size={16}
                        aria-hidden
                        style={{ transform: isOpen ? 'rotate(180deg)' : undefined }}
                      />
                    </button>
                    <strong
                      className="corrida-title"
                      title={formatCorridaFecha(corrida.fecha)}
                    >
                      Corrida · {formatCorridaFecha(corrida.fecha)}
                    </strong>
                  </div>
                }
                badge={
                  <span className="muted" style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                    {corrida.mensajes.length} {corrida.mensajes.length === 1 ? 'mensaje' : 'mensajes'}
                    {corrida.mes ? ` · ${monthLabel(`${corrida.mes}-01`)}` : ''}
                  </span>
                }
                footer={
                  <div className="row" style={{ gap: '0.35rem', flexWrap: 'wrap' }}>
                    {isOpen ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          title={allChecked ? 'No incluir ninguno' : 'Incluir todos'}
                          aria-label={allChecked ? 'No incluir ninguno' : 'Incluir todos'}
                          onClick={() => toggleTodos(corrida)}
                        >
                          {allChecked ? (
                            <Square size={16} aria-hidden />
                          ) : (
                            <CheckSquare size={16} aria-hidden />
                          )}
                          <span className="btn-label">{allChecked ? 'Ninguno' : 'Todos'}</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary"
                          title="Copiar seleccionados"
                          disabled={!selCount}
                          onClick={() => void copyCorrida(corrida)}
                        >
                          <Copy size={16} aria-hidden />{' '}
                          <span className="btn-label">
                            {copiedAll ? 'Copiado' : `Copiar (${selCount})`}
                          </span>
                        </button>
                        <button
                          type="button"
                          className="btn"
                          title="Descargar TXT"
                          aria-label="Descargar TXT"
                          disabled={!selCount}
                          onClick={() => downloadCorrida(corrida)}
                        >
                          <Download size={16} aria-hidden /> <span className="btn-label">TXT</span>
                        </button>
                        <ShareMenu title="Mensajes de inspección" text={textoSeleccionados(corrida)} />
                      </>
                    ) : null}
                    <button
                      type="button"
                      className="icon-btn icon-btn-delete"
                      title="Borrar corrida"
                      aria-label="Borrar corrida"
                      onClick={() => borrarCorrida(corrida)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                }
              >
                {isOpen ? (
                  <div className="stack" style={{ gap: 0 }}>
                    {corrida.mensajes.map((m) => {
                      const checked = selSet.has(m.fichaId)
                      const key = `${corrida.id}:${m.fichaId}`
                      const copied = copiedKey === key
                      return (
                        <div key={m.fichaId} className="corrida-msg">
                          <div
                            className="row"
                            style={{ gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleOne(corrida.id, m.fichaId)}
                              aria-label={`Incluir ${m.titulo}`}
                            />
                            <Link
                              to={`/fichas/${m.fichaId}`}
                              style={{
                                fontWeight: 650,
                                minWidth: 0,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {m.titulo}
                            </Link>
                            {m.estado ? <StatusBadge estado={m.estado} /> : null}
                            <span style={{ flex: 1 }} />
                            <button
                              type="button"
                              className="icon-btn"
                              title={copied ? 'Copiado' : 'Copiar mensaje'}
                              aria-label="Copiar mensaje"
                              onClick={() => void copyOne(key, m.texto)}
                            >
                              {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
                            </button>
                            <ShareMenu title={`Mensaje - ${m.titulo}`} text={m.texto} iconOnly />
                          </div>
                          <p className="muted" style={{ margin: 0, fontSize: '0.82rem' }}>
                            {m.meta}
                          </p>
                          <div className="message-preview">
                            <p style={{ whiteSpace: 'pre-wrap' }}>{m.texto}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : null}
              </EntityCard>
            )
          })}
        </div>
      )}
    </div>
  )
}