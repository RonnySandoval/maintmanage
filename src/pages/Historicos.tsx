import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ArrowUpDown,
  Boxes,
  CalendarDays,
  CalendarOff,
  ChevronDown,
  CircleDot,
  FolderTree,
  History,
  Layers,
  Paperclip,
  Pencil,
  Search,
  SlidersHorizontal,
} from 'lucide-react'
import { db } from '../db'
import {
  ESTADOS,
  esExtraordinaria,
  prioridadOf,
  prioridadRank,
  tipoAccionOf,
  type AccionCorrectiva,
  type Actividad,
  type Adjunto,
  type EstadoOcurrencia,
  type Ejecucion,
  type Encargado,
  type Evento,
  type Ficha,
  type Ocurrencia,
} from '../db/types'
import { bloqueColorVar, kindActividadVar } from '../lib/colors'
import { formatDate, formatFechaProgramada, monthLabel, monthValue } from '../lib/dates'
import { accionHref, accionSearchText, estadoAgendaCorrectiva } from '../lib/acciones'
import { actividadTitulo, compareActividadesByTitulo } from '../lib/actividades'
import { compareFichasByNumero, fichaTitulo } from '../lib/fichas'
import { ActividadTitle } from '../components/ActividadTitle'
import { AdjuntosMark } from '../components/AdjuntosMark'
import { AttachmentList, removeAdjunto } from '../components/AttachmentList'
import { DocumentosAgrupados, type DocumentosGrupo } from '../components/DocumentosAgrupados'
import { FichaTitle } from '../components/FichaTitle'
import { PrioridadMark } from '../components/PrioridadMark'
import { ExpandableText } from '../components/ExpandableText'
import { EjecucionModal } from '../components/EjecucionForm'
import { ShareMenu } from '../components/ShareMenu'
import { CorrectivaBadge, EmptyState, ExtraBadge, StatusBadge, AccionFechaLabel, TipoBadge } from '../components/ui'
import { EntityCard } from '../components/EntityCard'
import { FilterDrawerSlot, type FilterTool } from '../hooks/useFilterDrawer'
import { InboxAlert } from '../components/InboxAlert'
import { EMPTY_COUNTS, buildAdjuntoCounts } from '../lib/adjuntos'
import { etiquetasOf } from '../lib/etiquetasAdjuntos'

type AccGroup = 'lista' | 'fecha' | 'prioridad' | 'estado' | 'ficha'
type AccSort = 'fecha' | 'prioridad' | 'reciente'
type EjecVista = 'ejecuciones' | 'evidencias'

function sortAcciones(rows: AccionCorrectiva[], sort: AccSort): AccionCorrectiva[] {
  return [...rows].sort((a, b) => {
    if (sort === 'prioridad') {
      const d = prioridadRank(prioridadOf(a)) - prioridadRank(prioridadOf(b))
      if (d) return d
    }
    if (sort === 'fecha') {
      if (a.fechaObjetivo && b.fechaObjetivo) return a.fechaObjetivo.localeCompare(b.fechaObjetivo)
      if (a.fechaObjetivo) return -1
      if (b.fechaObjetivo) return 1
    }
    return b.updatedAt - a.updatedAt
  })
}

function groupAcciones(
  rows: AccionCorrectiva[],
  group: AccGroup,
  fichaMap: Record<string, Ficha>,
  actividadMap: Record<string, Actividad>,
): { key: string; label: string; items: AccionCorrectiva[] }[] {
  if (group === 'lista') return [{ key: 'all', label: '', items: rows }]

  const buckets = new Map<string, AccionCorrectiva[]>()
  const labels = new Map<string, string>()

  function push(key: string, label: string, item: AccionCorrectiva) {
    const list = buckets.get(key) ?? []
    list.push(item)
    buckets.set(key, list)
    labels.set(key, label)
  }

  for (const a of rows) {
    if (group === 'fecha') {
      push(a.fechaObjetivo ? 'con' : 'sin', a.fechaObjetivo ? 'Con fecha' : 'Sin fecha', a)
    } else if (group === 'prioridad') {
      const p = prioridadOf(a)
      push(p, p === 'alta' ? 'Alta' : p === 'media' ? 'Media' : 'Baja', a)
    } else if (group === 'estado') {
      const estado = estadoAgendaCorrectiva(a)
      const meta = ESTADOS.find((s) => s.id === estado)
      push(estado, meta?.label ?? estado, a)
    } else {
      if (a.actividadId) {
        const act = actividadMap[a.actividadId]
        push(`act:${a.actividadId}`, act ? actividadTitulo(act) : 'Actividad', a)
      } else {
        const ficha = a.fichaId ? fichaMap[a.fichaId] : undefined
        push(`ficha:${a.fichaId ?? 'none'}`, ficha ? fichaTitulo(ficha) : 'Sin ficha', a)
      }
    }
  }

  const order =
    group === 'fecha'
      ? ['con', 'sin']
      : group === 'prioridad'
        ? ['alta', 'media', 'baja']
        : group === 'estado'
          ? ESTADOS.map((s) => s.id)
          : [...buckets.keys()].sort((a, b) => (labels.get(a) ?? '').localeCompare(labels.get(b) ?? '', 'es'))

  return order
    .filter((key) => buckets.has(key))
    .map((key) => ({ key, label: labels.get(key) ?? key, items: buckets.get(key) ?? [] }))
}

export function HistoricosPage() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'acciones' ? 'acciones' : 'ocurrencias'
  const ejecVista: EjecVista = params.get('vista') === 'evidencias' ? 'evidencias' : 'ejecuciones'
  const q = params.get('q') ?? ''
  const bloqueId = params.get('bloque') ?? ''
  const encargadoId = params.get('encargado') ?? ''
  const fechaFiltro =
    params.get('fecha') === 'sin' || params.get('fecha') === 'con' ? params.get('fecha')! : ''
  const estadoAccParam = params.get('estado')
  const estadoAcc: EstadoOcurrencia | '' =
    ESTADOS.some((s) => s.id === estadoAccParam) ? (estadoAccParam as EstadoOcurrencia) : ''
  const groupAccRaw = params.get('agrupar')
  const groupAcc: AccGroup =
    groupAccRaw === 'fecha' ||
    groupAccRaw === 'prioridad' ||
    groupAccRaw === 'estado' ||
    groupAccRaw === 'ficha'
      ? groupAccRaw
      : 'lista'
  const sortAccRaw = params.get('ordenar')
  const sortAcc: AccSort =
    sortAccRaw === 'prioridad' || sortAccRaw === 'reciente' ? sortAccRaw : 'fecha'
  const [searchText, setSearchText] = useState(q)
  const [groupBy, setGroupBy] = useState<'ficha' | 'bloque' | 'fecha'>('ficha')
  const [openOcc, setOpenOcc] = useState<string | null>(null)

  function setParam(key: string, value: string) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (!value) next.delete(key)
        else next.set(key, value)
        return next
      },
      { replace: true },
    )
  }

  function setTab(next: 'ocurrencias' | 'acciones') {
    setParams(
      (current) => {
        const nextParams = new URLSearchParams(current)
        if (next === 'ocurrencias') nextParams.delete('tab')
        else nextParams.set('tab', 'acciones')
        if (next === 'ocurrencias') {
          nextParams.delete('fecha')
          nextParams.delete('estado')
          nextParams.delete('agrupar')
          nextParams.delete('ordenar')
        } else {
          nextParams.delete('bloque')
          nextParams.delete('encargado')
          nextParams.delete('vista')
        }
        return nextParams
      },
      { replace: true },
    )
  }

  function setEjecVista(next: EjecVista) {
    setParam('vista', next === 'evidencias' ? 'evidencias' : '')
  }

  useEffect(() => {
    setSearchText(q)
  }, [q])

  function onSearchChange(value: string) {
    setSearchText(value)
    setParam('q', value)
  }

  function clearFilters() {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        for (const key of ['q', 'bloque', 'encargado', 'fecha', 'estado', 'agrupar', 'ordenar', 'vista']) {
          next.delete(key)
        }
        return next
      },
      { replace: true },
    )
    setGroupBy('ficha')
  }

  const ocurrencias =
    useLiveQuery(async () => {
      const rows = await db.ocurrencias.where('estado').equals('ejecutada').toArray()
      return rows.sort((a, b) => b.fechaProgramada.localeCompare(a.fechaProgramada))
    }) ?? []
  const eventos =
    useLiveQuery(async () => {
      const rows = await db.eventos.where('estado').equals('ejecutada').toArray()
      return rows.sort((a, b) => b.fechaProgramada.localeCompare(a.fechaProgramada))
    }) ?? []
  const fichas = useLiveQuery(() => db.fichas.toArray()) ?? []
  const actividades = useLiveQuery(() => db.actividades.toArray()) ?? []
  const bloques = useLiveQuery(() => db.grupos.toArray()) ?? []
  const encargados = useLiveQuery(() => db.encargados.toArray()) ?? []
  const ejecuciones = useLiveQuery(() => db.ejecuciones.toArray()) ?? []
  const adjuntosEjecucion =
    useLiveQuery(() => db.adjuntos.where('tipo').equals('ejecucion').toArray()) ?? []
  const adjuntoCounts =
    useLiveQuery(async () => buildAdjuntoCounts(await db.adjuntos.toArray())) ?? EMPTY_COUNTS
  const acciones =
    useLiveQuery(async () => {
      const rows = await db.accionesCorrectivas.toArray()
      return rows.filter((a) => tipoAccionOf(a) === 'correctiva')
    }) ?? []

  const fichaMap = useMemo(() => Object.fromEntries(fichas.map((f) => [f.id, f])), [fichas])
  const actividadMap = useMemo(
    () => Object.fromEntries(actividades.map((a) => [a.id, a])),
    [actividades],
  )
  const bloqueMap = useMemo(() => Object.fromEntries(bloques.map((b) => [b.id, b])), [bloques])
  const encargadoMap = useMemo(
    () => Object.fromEntries(encargados.map((e) => [e.id, e])),
    [encargados],
  )
  const ejecucionById = useMemo(
    () => Object.fromEntries(ejecuciones.map((e) => [e.id, e])),
    [ejecuciones],
  )
  const ocurrenciaById = useMemo(
    () => Object.fromEntries(ocurrencias.map((o) => [o.id, o])),
    [ocurrencias],
  )
  const eventoById = useMemo(
    () => Object.fromEntries(eventos.map((e) => [e.id, e])),
    [eventos],
  )
  const ejecucionMap = useMemo(
    () =>
      Object.fromEntries(
        ejecuciones
          .filter((e) => e.ocurrenciaId)
          .map((e) => [e.ocurrenciaId as string, e]),
      ),
    [ejecuciones],
  )
  const ejecucionEventoMap = useMemo(
    () =>
      Object.fromEntries(
        ejecuciones.filter((e) => e.eventoId).map((e) => [e.eventoId as string, e]),
      ),
    [ejecuciones],
  )
  const ejecucionAccionMap = useMemo(
    () =>
      Object.fromEntries(
        ejecuciones.filter((e) => e.accionId).map((e) => [e.accionId as string, e]),
      ),
    [ejecuciones],
  )

  const accionesPorOcc = useMemo(() => {
    const map = new Map<string, AccionCorrectiva[]>()
    for (const a of acciones) {
      if (!a.ocurrenciaId) continue
      const list = map.get(a.ocurrenciaId) ?? []
      list.push(a)
      map.set(a.ocurrenciaId, list)
    }
    return map
  }, [acciones])
  const accionesPorEvento = useMemo(() => {
    const map = new Map<string, AccionCorrectiva[]>()
    for (const a of acciones) {
      if (!a.eventoId) continue
      const list = map.get(a.eventoId) ?? []
      list.push(a)
      map.set(a.eventoId, list)
    }
    return map
  }, [acciones])
  /** Correctivas ligadas a la ficha sin inspección concreta (antes “huérfanas” en Ejecutadas). */
  const accionesPorFichaSueltas = useMemo(() => {
    const map = new Map<string, AccionCorrectiva[]>()
    for (const a of acciones) {
      if (!a.fichaId || a.ocurrenciaId || tipoAccionOf(a) !== 'correctiva') continue
      const list = map.get(a.fichaId) ?? []
      list.push(a)
      map.set(a.fichaId, list)
    }
    return map
  }, [acciones])
  const accionesPorActividadSueltas = useMemo(() => {
    const map = new Map<string, AccionCorrectiva[]>()
    for (const a of acciones) {
      if (!a.actividadId || a.eventoId || tipoAccionOf(a) !== 'correctiva') continue
      const list = map.get(a.actividadId) ?? []
      list.push(a)
      map.set(a.actividadId, list)
    }
    return map
  }, [acciones])

  const qLower = q.trim().toLowerCase()

  const occsFiltradas = useMemo(() => {
    return ocurrencias.filter((o) => {
      const ficha = fichaMap[o.fichaId]
      if (!ficha) return false
      if (bloqueId && ficha.grupoId !== bloqueId) return false
      if (encargadoId && ficha.encargadoId !== encargadoId) return false
      if (qLower) {
        const enc = ficha.encargadoId ? encargadoMap[ficha.encargadoId]?.nombre ?? '' : ''
        const bloque = bloqueMap[ficha.grupoId]?.nombre ?? ''
        const ejec = ejecucionMap[o.id]
        const adjHay = ejec ? (adjuntoCounts.searchEjecucion[ejec.id] ?? '') : ''
        const hay =
          `${ficha.numero} ${ficha.nombre} ${bloque} ${enc} ${o.fechaProgramada} ${adjHay}`.toLowerCase()
        const accHit = [...(accionesPorOcc.get(o.id) ?? []), ...(accionesPorFichaSueltas.get(o.fichaId) ?? [])].some(
          (a) => accionSearchText(a).toLowerCase().includes(qLower),
        )
        if (!hay.includes(qLower) && !accHit) return false
      }
      return true
    })
  }, [
    ocurrencias,
    fichaMap,
    bloqueMap,
    encargadoMap,
    bloqueId,
    encargadoId,
    qLower,
    accionesPorOcc,
    accionesPorFichaSueltas,
    ejecucionMap,
    adjuntoCounts.searchEjecucion,
  ])

  const evtsFiltradas = useMemo(() => {
    return eventos.filter((e) => {
      const act = actividadMap[e.actividadId]
      if (!act) return false
      if (encargadoId && act.encargadoId !== encargadoId) return false
      if (bloqueId) return false
      if (qLower) {
        const enc = act.encargadoId ? encargadoMap[act.encargadoId]?.nombre ?? '' : ''
        const ejec = ejecucionEventoMap[e.id]
        const adjHay = ejec ? (adjuntoCounts.searchEjecucion[ejec.id] ?? '') : ''
        const hay = `${act.titulo} ${act.tipo} ${enc} ${e.fechaProgramada} ${adjHay}`.toLowerCase()
        const accHit = [
          ...(accionesPorEvento.get(e.id) ?? []),
          ...(accionesPorActividadSueltas.get(e.actividadId) ?? []),
        ].some((a) => accionSearchText(a).toLowerCase().includes(qLower))
        if (!hay.includes(qLower) && !accHit) return false
      }
      return true
    })
  }, [
    eventos,
    actividadMap,
    encargadoMap,
    bloqueId,
    encargadoId,
    qLower,
    accionesPorEvento,
    accionesPorActividadSueltas,
    ejecucionEventoMap,
    adjuntoCounts.searchEjecucion,
  ])

  const latestOccIdByFicha = useMemo(() => {
    const map = new Map<string, string>()
    const sorted = [...occsFiltradas].sort((a, b) => b.fechaProgramada.localeCompare(a.fechaProgramada))
    for (const o of sorted) {
      if (!map.has(o.fichaId)) map.set(o.fichaId, o.id)
    }
    return map
  }, [occsFiltradas])

  const latestEvtIdByActividad = useMemo(() => {
    const map = new Map<string, string>()
    const sorted = [...evtsFiltradas].sort((a, b) => b.fechaProgramada.localeCompare(a.fechaProgramada))
    for (const e of sorted) {
      if (!map.has(e.actividadId)) map.set(e.actividadId, e.id)
    }
    return map
  }, [evtsFiltradas])

  const byFicha = new Map<string, typeof occsFiltradas>()
  for (const o of occsFiltradas) {
    const list = byFicha.get(o.fichaId) ?? []
    list.push(o)
    byFicha.set(o.fichaId, list)
  }

  const byFechaOcc = new Map<string, typeof occsFiltradas>()
  for (const o of occsFiltradas) {
    const key = monthValue(o.fechaProgramada)
    const list = byFechaOcc.get(key) ?? []
    list.push(o)
    byFechaOcc.set(key, list)
  }
  const byActividad = new Map<string, typeof evtsFiltradas>()
  for (const e of evtsFiltradas) {
    const list = byActividad.get(e.actividadId) ?? []
    list.push(e)
    byActividad.set(e.actividadId, list)
  }
  const byFechaEvt = new Map<string, typeof evtsFiltradas>()
  for (const e of evtsFiltradas) {
    const key = monthValue(e.fechaProgramada)
    const list = byFechaEvt.get(key) ?? []
    list.push(e)
    byFechaEvt.set(key, list)
  }

  const fichasOrdenadas = [...byFicha.keys()].sort((a, b) => {
    const fa = fichaMap[a]
    const fb = fichaMap[b]
    if (!fa || !fb) return 0
    return fichaTitulo(fa).localeCompare(fichaTitulo(fb), 'es')
  })

  const fechasOrdenadas = [
    ...new Set([...byFechaOcc.keys(), ...byFechaEvt.keys()]),
  ].sort((a, b) => b.localeCompare(a))
  const actividadesOrdenadas = [...byActividad.keys()].sort((a, b) => {
    const aa = actividadMap[a]
    const ab = actividadMap[b]
    if (!aa || !ab) return 0
    return actividadTitulo(aa).localeCompare(actividadTitulo(ab), 'es')
  })

  const byBloque = new Map<string, typeof occsFiltradas>()
  for (const o of occsFiltradas) {
    const key = fichaMap[o.fichaId]?.grupoId ?? 'none'
    const list = byBloque.get(key) ?? []
    list.push(o)
    byBloque.set(key, list)
  }
  const bloquesOrdenados = [...byBloque.keys()].sort((a, b) => {
    if (a === 'none') return 1
    if (b === 'none') return -1
    return (bloqueMap[a]?.nombre ?? '').localeCompare(bloqueMap[b]?.nombre ?? '', 'es')
  })
  const eventosPorFecha = [...evtsFiltradas].sort((a, b) =>
    b.fechaProgramada.localeCompare(a.fechaProgramada),
  )

  const accionesFiltradas = sortAcciones(
    acciones.filter((a) => {
      if (estadoAcc && estadoAgendaCorrectiva(a) !== estadoAcc) return false
      if (fechaFiltro === 'sin' && a.fechaObjetivo) return false
      if (fechaFiltro === 'con' && !a.fechaObjetivo) return false
      const ficha = a.fichaId ? fichaMap[a.fichaId] : undefined
      const act = a.actividadId ? actividadMap[a.actividadId] : undefined
      if (bloqueId && ficha?.grupoId !== bloqueId) return false
      if (encargadoId) {
        const enc = act?.encargadoId ?? ficha?.encargadoId
        if (enc !== encargadoId) return false
      }
      if (qLower) {
        const ejec = a.estado === 'ejecutada' ? ejecucionAccionMap[a.id] : undefined
        const adjHay = ejec ? (adjuntoCounts.searchEjecucion[ejec.id] ?? '') : ''
        const hay =
          `${accionSearchText(a)} ${ficha ? `${ficha.numero} ${ficha.nombre}` : ''} ${act?.titulo ?? ''} ${a.fechaObjetivo ?? 'sin fecha'} ${adjHay}`.toLowerCase()
        if (!hay.includes(qLower)) return false
      }
      return true
    }),
    sortAcc,
  )
  const gruposAcc = groupAcciones(accionesFiltradas, groupAcc, fichaMap, actividadMap)
  const sinProgramarCount = acciones.filter(
    (a) => !a.fechaObjetivo && a.estado !== 'ejecutada',
  ).length

  const evidenciasGrupos = useMemo(() => {
    const occIds = new Set(occsFiltradas.map((o) => o.id))
    const evtIds = new Set(evtsFiltradas.map((e) => e.id))
    const qLower = q.trim().toLowerCase()
    const byFicha = new Map<string, Adjunto[]>()
    const byActividad = new Map<string, Adjunto[]>()

    for (const adj of adjuntosEjecucion) {
      if (!adj.ejecucionId) continue
      const ejec = ejecucionById[adj.ejecucionId]
      if (!ejec || ejec.accionId) continue

      let fichaId = ''
      let actividadId = ''
      if (ejec.ocurrenciaId && occIds.has(ejec.ocurrenciaId)) {
        fichaId = ocurrenciaById[ejec.ocurrenciaId]?.fichaId ?? adj.fichaId ?? ''
      } else if (ejec.eventoId && evtIds.has(ejec.eventoId)) {
        actividadId = eventoById[ejec.eventoId]?.actividadId ?? adj.actividadId ?? ''
      } else {
        continue
      }

      if (qLower) {
        const hay = `${adj.nombre} ${etiquetasOf(adj.etiquetas).join(' ')}`.toLowerCase()
        const parentHay = fichaId
          ? `${fichaMap[fichaId]?.numero ?? ''} ${fichaMap[fichaId]?.nombre ?? ''}`.toLowerCase()
          : `${actividadMap[actividadId]?.titulo ?? ''}`.toLowerCase()
        if (!hay.includes(qLower) && !parentHay.includes(qLower)) continue
      }

      if (fichaId) {
        const list = byFicha.get(fichaId) ?? []
        list.push(adj)
        byFicha.set(fichaId, list)
      } else if (actividadId) {
        const list = byActividad.get(actividadId) ?? []
        list.push(adj)
        byActividad.set(actividadId, list)
      }
    }

    const groups: DocumentosGrupo[] = []
    const fichaIds = [...byFicha.keys()].sort((a, b) => {
      const fa = fichaMap[a]
      const fb = fichaMap[b]
      if (!fa || !fb) return 0
      return compareFichasByNumero(fa, fb)
    })
    for (const fichaId of fichaIds) {
      const ficha = fichaMap[fichaId]
      if (!ficha) continue
      const bloque = bloqueMap[ficha.grupoId]
      const encargado = ficha.encargadoId ? encargadoMap[ficha.encargadoId] : undefined
      const rows = (byFicha.get(fichaId) ?? []).sort((a, b) => b.createdAt - a.createdAt)
      groups.push({
        key: `ficha:${fichaId}`,
        title: <FichaTitle ficha={ficha} color={bloque?.color} />,
        shareTitle: fichaTitulo(ficha),
        href: `/fichas/${fichaId}`,
        meta: [
          'Evidencias de inspección',
          bloque?.nombre,
          encargado?.nombre,
          `${rows.length} archivo${rows.length === 1 ? '' : 's'}`,
        ]
          .filter(Boolean)
          .join(' · '),
        adjuntos: rows,
      })
    }

    const actIds = [...byActividad.keys()].sort((a, b) => {
      const aa = actividadMap[a]
      const bb = actividadMap[b]
      if (!aa || !bb) return 0
      return compareActividadesByTitulo(aa, bb)
    })
    for (const actId of actIds) {
      const act = actividadMap[actId]
      if (!act) continue
      const encargado = act.encargadoId ? encargadoMap[act.encargadoId] : undefined
      const rows = (byActividad.get(actId) ?? []).sort((a, b) => b.createdAt - a.createdAt)
      groups.push({
        key: `act:${actId}`,
        title: (
          <span className="occ-meta">
            <ActividadTitle actividad={act} />
            <TipoBadge tipo={act.tipo} />
          </span>
        ),
        shareTitle: actividadTitulo(act),
        href: `/actividades/${actId}`,
        meta: [
          'Evidencias de actividad',
          encargado?.nombre,
          `${rows.length} archivo${rows.length === 1 ? '' : 's'}`,
        ]
          .filter(Boolean)
          .join(' · '),
        adjuntos: rows,
      })
    }
    return groups
  }, [
    adjuntosEjecucion,
    ejecucionById,
    ocurrenciaById,
    eventoById,
    occsFiltradas,
    evtsFiltradas,
    fichaMap,
    actividadMap,
    bloqueMap,
    encargadoMap,
    q,
  ])

  function toggleOcc(id: string) {
    setOpenOcc((current) => (current === id ? null : id))
  }

  function renderOccRow(o: Ocurrencia, hideTitle: boolean) {
    const ficha = fichaMap[o.fichaId]
    const bloque = ficha ? bloqueMap[ficha.grupoId] : undefined
    const linked = accionesPorOcc.get(o.id) ?? []
    const sueltas =
      latestOccIdByFicha.get(o.fichaId) === o.id
        ? (accionesPorFichaSueltas.get(o.fichaId) ?? [])
        : []
    return (
      <EjecutadaRow
        key={o.id}
        occ={o}
        ficha={ficha}
        color={bloque?.color}
        encargado={ficha?.encargadoId ? encargadoMap[ficha.encargadoId] : undefined}
        ejecucion={ejecucionMap[o.id]}
        adjuntosCount={
          ejecucionMap[o.id] ? (adjuntoCounts.ejecucion[ejecucionMap[o.id].id] ?? 0) : 0
        }
        acciones={[...linked, ...sueltas]}
        hideTitle={hideTitle}
        open={openOcc === o.id}
        onToggle={() => toggleOcc(o.id)}
      />
    )
  }

  function renderEvtRow(e: Evento, hideTitle: boolean) {
    const act = actividadMap[e.actividadId]
    const linked = accionesPorEvento.get(e.id) ?? []
    const sueltas =
      latestEvtIdByActividad.get(e.actividadId) === e.id
        ? (accionesPorActividadSueltas.get(e.actividadId) ?? [])
        : []
    return (
      <EjecutadaRow
        key={e.id}
        evento={e}
        actividad={act}
        encargado={act?.encargadoId ? encargadoMap[act.encargadoId] : undefined}
        ejecucion={ejecucionEventoMap[e.id]}
        adjuntosCount={
          ejecucionEventoMap[e.id]
            ? (adjuntoCounts.ejecucion[ejecucionEventoMap[e.id].id] ?? 0)
            : 0
        }
        acciones={[...linked, ...sueltas]}
        hideTitle={hideTitle}
        open={openOcc === e.id}
        onToggle={() => toggleOcc(e.id)}
      />
    )
  }

  const filterTools = useMemo<FilterTool[]>(() => {
    if (tab === 'acciones') {
      return [
        {
          id: 'filtrar',
          label: 'Filtrar',
          icon: CalendarOff,
          active: Boolean(fechaFiltro || bloqueId || encargadoId),
          content: (
            <div className="stack" style={{ gap: '0.7rem' }}>
              <div className="field" style={{ margin: 0 }}>
                <label htmlFor="hist-fecha">Fecha objetivo</label>
                <select
                  id="hist-fecha"
                  className="select"
                  value={fechaFiltro}
                  onChange={(e) => setParam('fecha', e.target.value)}
                >
                  <option value="">Todas</option>
                  <option value="sin">Sin programar</option>
                  <option value="con">Con fecha</option>
                </select>
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label htmlFor="hist-acc-bloque">Bloque (origen ficha)</label>
                <select
                  id="hist-acc-bloque"
                  className="select"
                  value={bloqueId}
                  onChange={(e) => setParam('bloque', e.target.value)}
                >
                  <option value="">Todos</option>
                  {bloques.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label htmlFor="hist-acc-enc">Encargado</label>
                <select
                  id="hist-acc-enc"
                  className="select"
                  value={encargadoId}
                  onChange={(e) => setParam('encargado', e.target.value)}
                >
                  <option value="">Todos</option>
                  {encargados.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ),
        },
        {
          id: 'estado',
          label: 'Estado',
          icon: CircleDot,
          active: Boolean(estadoAcc),
          content: (
            <div className="chip-row tight" role="tablist" aria-label="Estado">
              <button
                type="button"
                className={`chip compact${!estadoAcc ? ' active' : ''}`}
                onClick={() => setParam('estado', '')}
              >
                Todos
              </button>
              {ESTADOS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`chip compact${estadoAcc === s.id ? ' active' : ''}`}
                  onClick={() => setParam('estado', s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          ),
        },
        {
          id: 'agrupar',
          label: 'Agrupar',
          icon: Layers,
          active: groupAcc !== 'lista',
          content: (
            <div className="chip-row tight" role="tablist" aria-label="Agrupar">
              {(
                [
                  ['lista', 'Lista'],
                  ['fecha', 'Fecha'],
                  ['prioridad', 'Prioridad'],
                  ['estado', 'Estado'],
                  ['ficha', 'Origen'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`chip compact${groupAcc === id ? ' active' : ''}`}
                  onClick={() => setParam('agrupar', id === 'lista' ? '' : id)}
                >
                  {label}
                </button>
              ))}
            </div>
          ),
        },
        {
          id: 'ordenar',
          label: 'Ordenar',
          icon: ArrowUpDown,
          active: sortAcc !== 'fecha',
          content: (
            <div className="chip-row tight" role="tablist" aria-label="Ordenar">
              {(
                [
                  ['fecha', 'Fecha'],
                  ['prioridad', 'Prioridad'],
                  ['reciente', 'Recientes'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`chip compact${sortAcc === id ? ' active' : ''}`}
                  onClick={() => setParam('ordenar', id === 'fecha' ? '' : id)}
                >
                  {label}
                </button>
              ))}
            </div>
          ),
        },
      ]
    }
    return [
      {
        id: 'filtrar',
        label: 'Filtrar',
        icon: SlidersHorizontal,
        active: Boolean(bloqueId || encargadoId),
        content: (
          <div className="stack" style={{ gap: '0.7rem' }}>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="hist-bloque">Bloque</label>
              <select
                id="hist-bloque"
                className="select"
                value={bloqueId}
                onChange={(e) => setParam('bloque', e.target.value)}
              >
                <option value="">Todos</option>
                {bloques.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="hist-enc">Encargado</label>
              <select
                id="hist-enc"
                className="select"
                value={encargadoId}
                onChange={(e) => setParam('encargado', e.target.value)}
              >
                <option value="">Todos</option>
                {encargados.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ),
      },
      {
        id: 'ejecuciones',
        label: 'Ejecuciones',
        icon: History,
        active: ejecVista === 'ejecuciones',
        onClick: () => setEjecVista('ejecuciones'),
      },
      {
        id: 'evidencias',
        label: 'Evidencias',
        icon: Paperclip,
        active: ejecVista === 'evidencias',
        onClick: () => setEjecVista('evidencias'),
      },
      ...(ejecVista === 'evidencias'
        ? []
        : ([
            {
              id: 'ficha',
              label: 'Por ficha',
              icon: FolderTree,
              active: groupBy === 'ficha',
              onClick: () => setGroupBy('ficha'),
            },
            {
              id: 'bloque',
              label: 'Por bloque',
              icon: Boxes,
              active: groupBy === 'bloque',
              onClick: () => setGroupBy('bloque'),
            },
            {
              id: 'fecha',
              label: 'Por fecha',
              icon: CalendarDays,
              active: groupBy === 'fecha',
              onClick: () => setGroupBy('fecha'),
            },
          ] as FilterTool[])),
    ]
  }, [
    tab,
    estadoAcc,
    groupAcc,
    sortAcc,
    groupBy,
    fechaFiltro,
    bloqueId,
    encargadoId,
    bloques,
    encargados,
    ejecVista,
  ])

  if (!ocurrencias.length && !eventos.length && !acciones.length) {
    return (
      <EmptyState
        icon={<History size={36} />}
        title="Sin histórico"
        text="Cuando ejecutes fichas, actividades o registres acciones correctivas, aparecerán aquí."
      />
    )
  }

  return (
    <div>
      <FilterDrawerSlot
        title={tab === 'acciones' ? 'Correctivas' : 'Ejecutadas'}
        tools={filterTools}
        canClear={
          Boolean(q || bloqueId || encargadoId || fechaFiltro || estadoAcc || ejecVista === 'evidencias') ||
          groupAcc !== 'lista' ||
          sortAcc !== 'fecha' ||
          groupBy !== 'ficha'
        }
        onClear={clearFilters}
      />
      <div className="hist-toolbar">
        <div className="seg-toggle" role="tablist" aria-label="Histórico">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'ocurrencias'}
            className={tab === 'ocurrencias' ? 'active' : ''}
            onClick={() => setTab('ocurrencias')}
          >
            Ejecutadas
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'acciones'}
            className={tab === 'acciones' ? 'active' : ''}
            onClick={() => setTab('acciones')}
          >
            Correctivas
            {sinProgramarCount > 0 ? (
              <span className="tab-count" title="Sin programar">
                {sinProgramarCount}
              </span>
            ) : null}
          </button>
        </div>
      </div>

      {tab === 'ocurrencias' && ejecVista === 'evidencias' ? (
        <p className="muted hist-vista-hint">
          Evidencias agrupadas por ficha o actividad.
        </p>
      ) : null}

      <label className="search-field" htmlFor="hist-q">
        <Search size={16} aria-hidden />
        <input
          id="hist-q"
          className="input"
          type="search"
          placeholder={
            tab === 'acciones'
              ? 'Buscar correctiva, origen o etiqueta'
              : ejecVista === 'evidencias'
                ? 'Buscar evidencia, ficha, actividad o etiqueta'
                : 'Buscar ficha, actividad, encargado o etiqueta'
          }
          value={searchText}
          onChange={(e) => onSearchChange(e.target.value)}
          autoComplete="off"
          enterKeyHint="search"
          inputMode="search"
        />
      </label>

      {sinProgramarCount > 0 && (tab !== 'acciones' || fechaFiltro !== 'sin') ? (
        <InboxAlert count={sinProgramarCount} />
      ) : null}

      {tab === 'acciones' && fechaFiltro === 'sin' ? (
        <p className="muted" style={{ marginTop: 0 }}>
          Bandeja de correctivas pendientes de planificar.{' '}
          <button type="button" className="btn btn-ghost" onClick={() => setParam('fecha', '')}>
            Ver todas
          </button>
        </p>
      ) : null}

      {tab === 'ocurrencias' ? (
        <>
          {ejecVista === 'evidencias' ? (
            <DocumentosAgrupados
              groups={evidenciasGrupos}
              emptyText={
                q || bloqueId || encargadoId
                  ? 'No hay evidencias con esos filtros.'
                  : 'Aún no hay evidencias adjuntas en ejecuciones.'
              }
            />
          ) : occsFiltradas.length === 0 && evtsFiltradas.length === 0 ? (
            <div className="table-card">
              <p className="table-empty">
                {q || bloqueId || encargadoId
                  ? 'No hay ejecuciones con esos filtros.'
                  : 'Aún no hay inspecciones ni actividades ejecutadas.'}
              </p>
            </div>
          ) : (
            <div className="table-card">
              <div className="table-head table-cols-hist-occ">
                <span className="table-bar" aria-hidden />
                <span>Origen</span>
                <span className="col-md">Acciones</span>
                <span>Estado</span>
              </div>
              {groupBy === 'ficha' ? (
                <>
                  {fichasOrdenadas.map((fichaId) => {
                    const ficha = fichaMap[fichaId]
                    const bloque = ficha ? bloqueMap[ficha.grupoId] : undefined
                    const rows = (byFicha.get(fichaId) ?? []).sort((a, b) =>
                      b.fechaProgramada.localeCompare(a.fechaProgramada),
                    )
                    return (
                      <section key={fichaId}>
                        <div className="table-section">
                          <FichaTitle ficha={ficha} color={bloque?.color} />
                        </div>
                        {rows.map((o) => renderOccRow(o, true))}
                      </section>
                    )
                  })}
                  {actividadesOrdenadas.map((actId) => {
                    const act = actividadMap[actId]
                    const rows = (byActividad.get(actId) ?? []).sort((a, b) =>
                      b.fechaProgramada.localeCompare(a.fechaProgramada),
                    )
                    return (
                      <section key={actId}>
                        <div className="table-section">
                          <span className="occ-meta">
                            <ActividadTitle actividad={act} />
                            {act ? <TipoBadge tipo={act.tipo} /> : null}
                          </span>
                        </div>
                        {rows.map((e) => renderEvtRow(e, true))}
                      </section>
                    )
                  })}
                </>
              ) : groupBy === 'bloque' ? (
                <>
                  {bloquesOrdenados.map((bloqueId) => {
                    const bloque = bloqueMap[bloqueId]
                    const rows = (byBloque.get(bloqueId) ?? []).sort((a, b) =>
                      b.fechaProgramada.localeCompare(a.fechaProgramada),
                    )
                    return (
                      <section key={bloqueId}>
                        <div
                          className="table-section"
                          style={bloque ? { color: bloqueColorVar(bloque.color) } : undefined}
                        >
                          {bloque?.nombre ?? 'Sin bloque'}
                        </div>
                        {rows.map((o) => renderOccRow(o, false))}
                      </section>
                    )
                  })}
                  {eventosPorFecha.length ? (
                    <section>
                      <div className="table-section">Actividades</div>
                      {eventosPorFecha.map((e) => renderEvtRow(e, false))}
                    </section>
                  ) : null}
                </>
              ) : (
                fechasOrdenadas.map((month) => {
                  const occRows = byFechaOcc.get(month) ?? []
                  const evtRows = byFechaEvt.get(month) ?? []
                  const mixed = [
                    ...occRows.map((o) => ({ kind: 'occ' as const, fecha: o.fechaProgramada, o })),
                    ...evtRows.map((e) => ({ kind: 'evt' as const, fecha: e.fechaProgramada, e })),
                  ].sort((a, b) => b.fecha.localeCompare(a.fecha))
                  return (
                    <section key={month}>
                      <div className="table-section">{monthLabel(month)}</div>
                      {mixed.map((item) =>
                        item.kind === 'occ' ? renderOccRow(item.o, false) : renderEvtRow(item.e, false),
                      )}
                    </section>
                  )
                })
              )}
            </div>
          )}
        </>
      ) : (
        <>
          {accionesFiltradas.length === 0 ? (
            <div className="table-card">
              <p className="table-empty">No hay registros con esos filtros.</p>
            </div>
          ) : (
            <div className="table-card">
              <div className="table-head table-cols-hist-acc">
                <span className="hist-acc-prio" title="Prioridad">
                  Prio
                </span>
                <span>Registro</span>
                <span className="col-md">Origen</span>
                <span className="col-md">Fecha</span>
                <span>Estado</span>
              </div>
              {gruposAcc.map((grupo) => (
                <section key={grupo.key}>
                  {grupo.label ? <div className="table-section">{grupo.label}</div> : null}
                  {grupo.items.map((a) => {
                    const ficha = a.fichaId ? fichaMap[a.fichaId] : undefined
                    const act = a.actividadId ? actividadMap[a.actividadId] : undefined
                    const bloque = ficha ? bloqueMap[ficha.grupoId] : undefined
                    const origen = act ? actividadTitulo(act) : ficha ? fichaTitulo(ficha) : ''
                    const ejec = a.estado === 'ejecutada' ? ejecucionAccionMap[a.id] : undefined
                    const adjCount = ejec ? (adjuntoCounts.ejecucion[ejec.id] ?? 0) : 0
                    return (
                      <Link key={a.id} className="table-row table-cols-hist-acc" to={accionHref(a)}>
                        <span className="hist-acc-prio">
                          <PrioridadMark prioridad={prioridadOf(a)} iconOnly />
                        </span>
                        <span className="table-cell">
                          <span className="row" style={{ flexWrap: 'wrap', gap: '0.35rem', alignItems: 'flex-start' }}>
                            <ExpandableText text={a.texto} maxLines={2} maxChars={110} />
                            <AdjuntosMark count={adjCount} />
                          </span>
                          {a.detalle?.trim() ? (
                            <ExpandableText
                              text={a.detalle}
                              className="muted"
                              maxLines={2}
                              maxChars={100}
                            />
                          ) : null}
                          <span className="muted col-sm-only">
                            {origen}
                            {origen ? ' · ' : ''}
                            <AccionFechaLabel fechaObjetivo={a.fechaObjetivo} />
                          </span>
                        </span>
                        <span className="col-md hist-acc-origen">
                          {act ? (
                            <ActividadTitle actividad={act} />
                          ) : (
                            <FichaTitle ficha={ficha} color={bloque?.color} />
                          )}
                        </span>
                        <span className="col-md muted table-nowrap hist-acc-fecha">
                          <AccionFechaLabel fechaObjetivo={a.fechaObjetivo} />
                        </span>
                        <span className="hist-acc-estado">
                          <StatusBadge estado={estadoAgendaCorrectiva(a)} />
                        </span>
                      </Link>
                    )
                  })}
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function EjecutadaRow({
  occ,
  evento,
  ficha,
  actividad,
  color,
  encargado,
  ejecucion,
  adjuntosCount = 0,
  acciones,
  hideTitle,
  open,
  onToggle,
}: {
  occ?: Ocurrencia
  evento?: Evento
  ficha?: Ficha
  actividad?: Actividad
  color?: string
  encargado?: Encargado
  ejecucion?: Ejecucion
  adjuntosCount?: number
  acciones: AccionCorrectiva[]
  hideTitle?: boolean
  open: boolean
  onToggle: () => void
}) {
  const [editOpen, setEditOpen] = useState(false)
  const item = occ ?? evento
  if (!item) return null
  const href = occ ? `/ocurrencias/${occ.id}` : `/eventos/${evento?.id}`
  const precision =
    (ficha?.fechaPrecision ?? actividad?.fechaPrecision) === 'dia' ? 'dia' : 'mes'
  const barColor = actividad ? kindActividadVar() : bloqueColorVar(color)
  const fecha = formatFechaProgramada(item.fechaProgramada, precision)
  const shareTitle = ficha ? fichaTitulo(ficha) : actividad ? actividadTitulo(actividad) : 'Ejecución'
  const shareText = [
    ficha ? `Ficha: ${fichaTitulo(ficha)}` : '',
    actividad ? `Actividad: ${actividadTitulo(actividad)}` : '',
    `Programada: ${item.fechaProgramada}`,
    ejecucion?.fechaReal ? `Realizada: ${ejecucion.fechaReal}` : '',
    ejecucion?.realizadoPor ? `Realizado por: ${ejecucion.realizadoPor}` : '',
    encargado ? `Encargado: ${encargado.nombre}` : '',
    ejecucion?.observaciones ? `Observaciones: ${ejecucion.observaciones}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  return (
    <div className={`hist-occ-item${open ? ' is-open' : ''}`}>
      <div className="table-row table-cols-hist-occ">
        <span className="table-bar" style={{ background: barColor }} />
        <Link className="table-cell hist-occ-main" to={href}>
          {!hideTitle && ficha ? <FichaTitle ficha={ficha} color={color} /> : null}
          {!hideTitle && actividad ? (
            <span className="occ-meta">
              <ActividadTitle actividad={actividad} />
              <TipoBadge tipo={actividad.tipo} />
            </span>
          ) : null}
          <span className="muted hist-occ-when">
            {fecha}
            {encargado ? ` · ${encargado.nombre}` : ''}
          </span>
          {esExtraordinaria(item) || (hideTitle && actividad) || acciones.length || adjuntosCount ? (
            <span className="occ-meta">
              {esExtraordinaria(item) ? <ExtraBadge /> : null}
              {hideTitle && actividad ? <TipoBadge tipo={actividad.tipo} /> : null}
              <CorrectivaBadge count={acciones.length} />
              <AdjuntosMark count={adjuntosCount} />
            </span>
          ) : null}
        </Link>
        <span className="col-md muted table-nowrap">{acciones.length || '—'}</span>
        <span className="table-nowrap hist-occ-end">
          <button
            type="button"
            className="icon-btn hist-occ-toggle"
            aria-expanded={open}
            aria-label={open ? 'Ocultar detalle' : 'Ver detalle de la ejecución'}
            onClick={onToggle}
          >
            <ChevronDown size={16} className={open ? 'is-open' : ''} />
          </button>
          <StatusBadge estado="ejecutada" />
        </span>
      </div>
      {open ? (
        <div className="hist-occ-acciones">
          {acciones.length ? (
            <div className="hist-occ-acciones-head">
              <span className="muted">Correctivas</span>
            </div>
          ) : null}
          <EntityCard
            nested
            className="hist-occ-ejecucion"
            title={<strong>Ejecución</strong>}
            footer={
              ficha || actividad ? (
                <>
                  <span />
                  <div className="row" style={{ gap: 2 }}>
                    <button
                      type="button"
                      className="icon-btn icon-btn-edit"
                      aria-label="Editar ejecución"
                      title="Editar ejecución"
                      onClick={() => setEditOpen(true)}
                    >
                      <Pencil size={16} />
                    </button>
                    <ShareMenu title={shareTitle} text={shareText} iconOnly />
                  </div>
                </>
              ) : null
            }
          >
            {ejecucion ? (
              <>
                <p>
                  Realizada el <strong>{formatDate(ejecucion.fechaReal)}</strong>
                  {ejecucion.realizadoPor ? ` · ${ejecucion.realizadoPor}` : ''}
                </p>
                {ejecucion.observaciones ? (
                  <ExpandableText text={ejecucion.observaciones} maxLines={4} maxChars={220} />
                ) : (
                  <p className="muted">Sin observaciones.</p>
                )}
                <div className="hist-occ-adjuntos">
                  <p className="muted" style={{ margin: '0.55rem 0 0' }}>
                    Archivos adjuntos
                  </p>
                  <EjecucionAdjuntosPanel ejecucionId={ejecucion.id} />
                </div>
              </>
            ) : (
              <p className="muted">Sin registro de ejecución.</p>
            )}
          </EntityCard>
          {acciones.length ? (
            acciones.map((a) => (
              <Link key={a.id} className="hist-occ-accion" to={accionHref(a)}>
                <PrioridadMark prioridad={prioridadOf(a)} iconOnly />
                <span className="grow hist-occ-accion-text">
                  <ExpandableText text={a.texto} maxLines={2} maxChars={100} />
                  {a.detalle?.trim() ? (
                    <ExpandableText
                      text={a.detalle}
                      className="muted"
                      maxLines={2}
                      maxChars={90}
                    />
                  ) : null}
                </span>
                <AccionFechaLabel fechaObjetivo={a.fechaObjetivo} gated />
                <StatusBadge estado={estadoAgendaCorrectiva(a)} />
              </Link>
            ))
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              Sin acciones correctivas.
            </p>
          )}
        </div>
      ) : null}
      {ficha && occ ? (
        <EjecucionModal
          open={editOpen}
          ocurrenciaId={occ.id}
          fichaId={ficha.id}
          onClose={() => setEditOpen(false)}
        />
      ) : null}
      {actividad && evento ? (
        <EjecucionModal
          open={editOpen}
          eventoId={evento.id}
          actividadId={actividad.id}
          onClose={() => setEditOpen(false)}
        />
      ) : null}
    </div>
  )
}

function EjecucionAdjuntosPanel({ ejecucionId }: { ejecucionId: string }) {
  const adjuntos =
    useLiveQuery(
      () => db.adjuntos.where('ejecucionId').equals(ejecucionId).toArray(),
      [ejecucionId],
    ) ?? []
  return (
    <AttachmentList
      adjuntos={adjuntos}
      onDelete={(adjId) => void removeAdjunto(adjId)}
      editableTags
    />
  )
}
