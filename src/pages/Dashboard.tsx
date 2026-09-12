import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  CalendarClock,
  CalendarDays,
  CircleCheck,
  ClipboardList,
  Clock,
  ShieldAlert,
  TriangleAlert,
  Wrench,
} from 'lucide-react'
import { db } from '../db'
import { bloqueColorVar } from '../lib/colors'
import { formatDate, inCurrentQuarter, quarterLabel } from '../lib/dates'
import { accionesTitulo, label, useAliases } from '../lib/labels'
import {
  ESTADOS_CORRECTIVA,
  esExtraordinaria,
  prioridadOf,
  tipoAccionLabel,
  tipoAccionOf,
  tipoActividadColor,
} from '../db/types'
import { CountUp } from '../components/CountUp'
import { EmptyState, ExtraBadge, StatusBadge, TipoBadge } from '../components/ui'
import { ActividadTitle } from '../components/ActividadTitle'
import { PrioridadMark } from '../components/PrioridadMark'
import { FichaTitle } from '../components/FichaTitle'
import { RestorePanel } from '../components/RestorePanel'
import { isRestoreSkipped, skipRestore } from '../lib/restoreSkip'
import { accionHref } from '../lib/acciones'
import { useSettled } from '../hooks/useSettled'
import { useTiposActividad } from '../hooks/useTiposActividad'

type DashCounts = {
  vencidas: number
  programadas: number
  pendientes: number
  ejecutadas: number
  total: number
  progreso: number
  correctivasHechas: number
  correctivasTotal: number
  actividades: number
}

function packCounts(c: DashCounts): string {
  return `${c.vencidas}:${c.programadas}:${c.pendientes}:${c.ejecutadas}:${c.total}:${c.progreso}:${c.correctivasHechas}:${c.correctivasTotal}:${c.actividades}`
}

function unpackCounts(token: string): DashCounts {
  const [
    vencidas,
    programadas,
    pendientes,
    ejecutadas,
    total,
    progreso,
    correctivasHechas,
    correctivasTotal,
    actividades,
  ] = token.split(':').map(Number)
  return {
    vencidas,
    programadas,
    pendientes,
    ejecutadas,
    total,
    progreso,
    correctivasHechas,
    correctivasTotal,
    actividades,
  }
}

export function DashboardPage() {
  const ocurrencias = useLiveQuery(() => db.ocurrencias.toArray())
  const eventos = useLiveQuery(() => db.eventos.toArray())
  const fichas = useLiveQuery(() => db.fichas.toArray())
  const actividades = useLiveQuery(() => db.actividades.toArray())
  const bloques = useLiveQuery(() => db.grupos.toArray()) ?? []
  const acciones = useLiveQuery(() => db.accionesCorrectivas.toArray()) ?? []
  const extraCounts = useLiveQuery(async () => ({
    encargados: await db.encargados.count(),
    adjuntos: await db.adjuntos.count(),
    ejecuciones: await db.ejecuciones.count(),
  }))
  const tipos = useTiposActividad()
  const aliases = useAliases()
  const [skipRestoreUi, setSkipRestoreUi] = useState(isRestoreSkipped)
  const loaded =
    ocurrencias !== undefined &&
    fichas !== undefined &&
    eventos !== undefined &&
    actividades !== undefined
  const occs = ocurrencias ?? []
  const evts = eventos ?? []
  const fichasList = fichas ?? []
  const actividadesList = actividades ?? []

  const fichaMap = useMemo(
    () => Object.fromEntries(fichasList.map((f) => [f.id, f])),
    [fichasList],
  )
  const actividadMap = useMemo(
    () => Object.fromEntries(actividadesList.map((a) => [a.id, a])),
    [actividadesList],
  )
  const bloqueMap = useMemo(
    () => Object.fromEntries(bloques.map((b) => [b.id, b])),
    [bloques],
  )

  const trimestre = quarterLabel(new Date(), label('trimestre', aliases))
  const occsTrimestre = occs.filter((o) => inCurrentQuarter(o.fechaProgramada))
  const evtsTrimestre = evts.filter((e) => inCurrentQuarter(e.fechaProgramada))
  const delTrimestre = occsTrimestre
  const occById = useMemo(
    () => Object.fromEntries(occs.map((o) => [o.id, o])),
    [occs],
  )
  const correctivasTrimestre = acciones.filter((a) => {
    if (tipoAccionOf(a) !== 'correctiva') return false
    if (a.fechaObjetivo) return inCurrentQuarter(a.fechaObjetivo)
    const occ = a.ocurrenciaId ? occById[a.ocurrenciaId] : undefined
    return occ ? inCurrentQuarter(occ.fechaProgramada) : false
  })
  const accionesAbiertas = acciones.filter(
    (a) => a.estado === 'pendiente' || a.estado === 'programada',
  )
  const rawCounts: DashCounts = {
    vencidas: delTrimestre.filter((o) => o.estado === 'vencida').length,
    programadas: delTrimestre.filter((o) => o.estado === 'proxima').length,
    pendientes: delTrimestre.filter((o) => o.estado === 'pendiente').length,
    ejecutadas: delTrimestre.filter((o) => o.estado === 'ejecutada').length,
    total: delTrimestre.length,
    progreso:
      delTrimestre.length === 0
        ? 0
        : Math.round(
            (delTrimestre.filter((o) => o.estado === 'ejecutada').length / delTrimestre.length) * 100,
          ),
    correctivasHechas: correctivasTrimestre.filter((a) => a.estado === 'ejecutada').length,
    correctivasTotal: correctivasTrimestre.length,
    actividades: actividadesList.length,
  }
  const skipTransientEmpty = loaded && fichasList.length > 0 && occs.length === 0
  const settledToken = useSettled(
    packCounts(rawCounts),
    loaded && !skipTransientEmpty,
    320,
  )
  const counts = settledToken ? unpackCounts(settledToken) : null
  const ready = counts !== null

  const agendaOcc = [...occsTrimestre].sort((a, b) =>
    a.fechaProgramada.localeCompare(b.fechaProgramada),
  )
  const agendaEvt = [...evtsTrimestre].sort((a, b) =>
    a.fechaProgramada.localeCompare(b.fechaProgramada),
  )
  const agenda = [
    ...agendaOcc.map((o) => ({ kind: 'occ' as const, fecha: o.fechaProgramada, o })),
    ...agendaEvt.map((e) => ({ kind: 'evt' as const, fecha: e.fechaProgramada, e })),
  ].sort((a, b) => a.fecha.localeCompare(b.fecha))

  const totallyEmpty =
    loaded &&
    extraCounts !== undefined &&
    fichasList.length === 0 &&
    actividadesList.length === 0 &&
    bloques.length === 0 &&
    extraCounts.encargados === 0 &&
    extraCounts.adjuntos === 0 &&
    extraCounts.ejecuciones === 0

  if (loaded && fichasList.length === 0 && actividadesList.length === 0) {
    return (
      <div className="stack">
        {totallyEmpty && !skipRestoreUi ? (
          <RestorePanel
            onSkip={() => {
              skipRestore()
              setSkipRestoreUi(true)
            }}
          />
        ) : null}
        <EmptyState
          icon={<ClipboardList size={36} />}
          title="Aún no hay fichas ni actividades"
          text={`Crea bloques, encargados, fichas de ${label('inspeccion', aliases)} o actividades sueltas (${label('reparacion', aliases)}, ${label('compra', aliases)}, ${label('limpieza', aliases)}…).`}
          action={
            <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link className="btn btn-add" to="/fichas?tab=bloques">
                Crear bloque
              </Link>
              <Link className="btn btn-add" to="/fichas/nueva">
                Crear primera ficha
              </Link>
              <Link className="btn btn-add" to="/actividades/nueva">
                Crear actividad
              </Link>
            </div>
          }
        />
      </div>
    )
  }

  return (
    <div className="dash">
      <header className="dash-hero">
        <p className="dash-kicker">{label('trimestre', aliases)} en curso</p>
        <h2 className="dash-title">{trimestre}</h2>
        <p className="dash-sub">
          {ready ? (
            <>
              {counts.total} inspección{counts.total === 1 ? '' : 'es'}
              {counts.actividades
                ? ` · ${counts.actividades} actividad${counts.actividades === 1 ? '' : 'es'}`
                : ''}{' '}
              · {counts.progreso}% ejecutado
            </>
          ) : (
            `Calculando ${label('trimestre', aliases)}…`
          )}
        </p>
      </header>

      <div className="kpis">
        <Link className="card kpi card-click tone-vencida" to="/cronograma?estado=vencida">
          <div className="kpi-head">
            <TriangleAlert size={16} aria-hidden />
            <div className="label">Vencidas</div>
          </div>
          <div className="value">
            {ready ? <CountUp value={counts.vencidas} ready /> : <span className="count-wait">—</span>}
          </div>
        </Link>
        <Link className="card kpi card-click tone-proxima" to="/cronograma?estado=proxima">
          <div className="kpi-head">
            <CalendarClock size={16} aria-hidden />
            <div className="label">Programadas</div>
          </div>
          <div className="value">
            {ready ? <CountUp value={counts.programadas} ready /> : <span className="count-wait">—</span>}
          </div>
        </Link>
        <Link className="card kpi card-click tone-pendiente" to="/cronograma?estado=pendiente">
          <div className="kpi-head">
            <Clock size={16} aria-hidden />
            <div className="label">Pendientes</div>
          </div>
          <div className="value">
            {ready ? <CountUp value={counts.pendientes} ready /> : <span className="count-wait">—</span>}
          </div>
        </Link>
        <Link className="card kpi card-click tone-ejecutada" to="/cronograma?estado=ejecutada">
          <div className="kpi-head">
            <CircleCheck size={16} aria-hidden />
            <div className="label">Ejecutadas</div>
          </div>
          <div className="value">
            {ready ? <CountUp value={counts.ejecutadas} ready /> : <span className="count-wait">—</span>}
          </div>
        </Link>
        <Link className="card kpi card-click tone-actividad" to="/cronograma?ambito=actividades">
          <div className="kpi-head">
            <Wrench size={16} aria-hidden />
            <div className="label">Actividades</div>
          </div>
          <div className="value">
            {ready ? <CountUp value={counts.actividades} ready /> : <span className="count-wait">—</span>}
          </div>
        </Link>
        <Link className="card kpi card-click tone-correctiva" to="/historicos">
          <div className="kpi-head">
            <ShieldAlert size={16} aria-hidden />
            <div className="label">{accionesTitulo(true, aliases)}</div>
          </div>
          <div className="value kpi-frac">
            {ready ? (
              <>
                <CountUp value={counts.correctivasHechas} ready />
                <span className="kpi-slash">/</span>
                <span className="kpi-den">
                  <CountUp value={counts.correctivasTotal} ready />
                </span>
              </>
            ) : (
              <span className="count-wait">—</span>
            )}
          </div>
        </Link>
      </div>

      <div className="card dash-progress">
        <div className="row-spread" style={{ marginBottom: '0.55rem' }}>
          <strong>Avance del {label('trimestre', aliases)}</strong>
          <span className="dash-pct">{ready ? `${counts.progreso}%` : '—'}</span>
        </div>
        <div className="progress" aria-label={`Avance ${counts?.progreso ?? 0} por ciento`}>
          <span style={{ width: `${ready ? counts.progreso : 0}%` }} />
        </div>
      </div>

      <div className="page-head">
        <h2 className="title-sm">Agenda</h2>
        <Link to="/cronograma">Ver cronograma</Link>
      </div>
      {agenda.length === 0 ? (
        <div className="card muted">
          No hay actividades en este {label('trimestre', aliases)}.
        </div>
      ) : (
        <div className="list">
          {agenda.map((item) => {
            if (item.kind === 'occ') {
              const o = item.o
              const ficha = fichaMap[o.fichaId]
              const bloque = ficha ? bloqueMap[ficha.grupoId] : undefined
              return (
                <Link
                  key={`occ-${o.id}`}
                  className="card card-click item dash-item"
                  to={`/ocurrencias/${o.id}`}
                >
                  <span className="bar" style={{ background: bloqueColorVar(bloque?.color) }} />
                  <div className="grow">
                    <div className="row-spread">
                      <strong>
                        <FichaTitle ficha={ficha} color={bloque?.color} />
                      </strong>
                      <StatusBadge estado={o.estado} />
                    </div>
                    <div className="muted occ-meta">
                      {formatDate(o.fechaProgramada)}
                      {bloque ? ` · ${bloque.nombre}` : ''}
                      {esExtraordinaria(o) ? <ExtraBadge /> : null}
                    </div>
                  </div>
                </Link>
              )
            }
            const e = item.e
            const act = actividadMap[e.actividadId]
            if (!act) return null
            return (
              <Link
                key={`evt-${e.id}`}
                className="card card-click item dash-item"
                to={`/eventos/${e.id}`}
              >
                <span
                  className="bar"
                  style={{ background: bloqueColorVar(tipoActividadColor(act.tipo, tipos)) }}
                />
                <div className="grow">
                  <div className="row-spread">
                    <strong>
                      <ActividadTitle actividad={act} />
                    </strong>
                    <StatusBadge estado={e.estado} />
                  </div>
                  <div className="muted occ-meta">
                    {formatDate(e.fechaProgramada)}
                    {' · '}
                    <TipoBadge tipo={act.tipo} />
                    {esExtraordinaria(e) ? <ExtraBadge /> : null}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {accionesAbiertas.length > 0 ? (
        <div style={{ marginTop: '1.25rem' }}>
          <div className="page-head">
            <h2 className="title-sm">{accionesTitulo(false, aliases)} abiertas</h2>
            <Link to="/historicos">Ver histórico</Link>
          </div>
          <div className="list">
            {accionesAbiertas.slice(0, 5).map((a) => {
              const ficha = a.fichaId ? fichaMap[a.fichaId] : undefined
              const act = a.actividadId ? actividadMap[a.actividadId] : undefined
              const bloque = ficha ? bloqueMap[ficha.grupoId] : undefined
              return (
                <Link
                  key={a.id}
                  className="card card-click dash-item"
                  to={accionHref(a)}
                >
                  <div className="row-spread">
                    <strong>{a.texto}</strong>
                    <span className={`badge badge-${a.estado}`}>
                      {ESTADOS_CORRECTIVA.find((s) => s.id === a.estado)?.label ?? a.estado}
                    </span>
                  </div>
                  <div className="muted occ-meta">
                    {tipoAccionOf(a) === 'correctiva' ? <PrioridadMark prioridad={prioridadOf(a)} /> : null}
                    {tipoAccionLabel(tipoAccionOf(a), aliases)} ·{' '}
                    {act ? (
                      <ActividadTitle actividad={act} />
                    ) : (
                      <FichaTitle ficha={ficha} color={bloque?.color} />
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      ) : null}

      <p className="muted dash-foot">
        <CalendarDays size={14} /> Datos solo en este navegador. Sincroniza con una copia en Ajustes.
      </p>
    </div>
  )
}
