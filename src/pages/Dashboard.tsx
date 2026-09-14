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
import { formatDate, inCurrentQuarter, quarterLabel } from '../lib/dates'
import { accionesTitulo, label, useAliases } from '../lib/labels'
import {
  esExtraordinaria,
  prioridadOf,
  tipoAccionLabel,
  tipoAccionOf,
} from '../db/types'
import { CountUp } from '../components/CountUp'
import { EmptyState, ExtraBadge, StatusBadge, TipoBadge } from '../components/ui'
import { ActividadTitle } from '../components/ActividadTitle'
import { PrioridadMark } from '../components/PrioridadMark'
import { FichaTitle } from '../components/FichaTitle'
import { RestorePanel } from '../components/RestorePanel'
import { InboxAlert } from '../components/InboxAlert'
import { isRestoreSkipped, skipRestore } from '../lib/restoreSkip'
import { accionHref, estadoAgendaCorrectiva } from '../lib/acciones'
import { useSettled } from '../hooks/useSettled'

type DashCounts = {
  vencidas: number
  programadas: number
  pendientes: number
  ejecutadas: number
  total: number
  progreso: number
  correctivasHechas: number
  correctivasTotal: number
  actividadesHechas: number
  actividades: number
}

function packCounts(c: DashCounts): string {
  return `${c.vencidas}:${c.programadas}:${c.pendientes}:${c.ejecutadas}:${c.total}:${c.progreso}:${c.correctivasHechas}:${c.correctivasTotal}:${c.actividadesHechas}:${c.actividades}`
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
    actividadesHechas,
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
    actividadesHechas,
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
  const correctivasSinProgramar = accionesAbiertas.filter(
    (a) => tipoAccionOf(a) === 'correctiva' && !a.fechaObjetivo,
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
    actividadesHechas: evtsTrimestre.filter((e) => e.estado === 'ejecutada').length,
    actividades: evtsTrimestre.length,
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
  const pendientes = agenda.filter((item) => {
    const estado = item.kind === 'occ' ? item.o.estado : item.e.estado
    return estado === 'pendiente' || estado === 'vencida'
  })
  const ejecutadas = [...agenda]
    .filter((item) => (item.kind === 'occ' ? item.o.estado : item.e.estado) === 'ejecutada')
    .reverse()

  function renderDashItem(item: (typeof agenda)[number]) {
    if (item.kind === 'occ') {
      const o = item.o
      const ficha = fichaMap[o.fichaId]
      const bloque = ficha ? bloqueMap[ficha.grupoId] : undefined
      return (
        <Link key={`occ-${o.id}`} className="card card-click dash-item" to={`/ocurrencias/${o.id}`}>
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
        </Link>
      )
    }
    const e = item.e
    const act = actividadMap[e.actividadId]
    if (!act) return null
    return (
      <Link key={`evt-${e.id}`} className="card card-click dash-item" to={`/eventos/${e.id}`}>
        <div className="row-spread">
          <strong className="occ-meta">
            <ActividadTitle actividad={act} />
            <TipoBadge tipo={act.tipo} />
          </strong>
          <StatusBadge estado={e.estado} />
        </div>
        <div className="muted occ-meta">
          {formatDate(e.fechaProgramada)}
          {esExtraordinaria(e) ? <ExtraBadge /> : null}
        </div>
      </Link>
    )
  }

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

      {correctivasSinProgramar.length > 0 ? (
        <InboxAlert count={correctivasSinProgramar.length} />
      ) : null}

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
          <div className="value kpi-frac">
            {ready ? (
              <>
                <CountUp value={counts.actividadesHechas} ready />
                <span className="kpi-slash">/</span>
                <span className="kpi-den">
                  <CountUp value={counts.actividades} ready />
                </span>
              </>
            ) : (
              <span className="count-wait">—</span>
            )}
          </div>
        </Link>
        <Link className="card kpi card-click tone-correctiva" to="/historicos?tab=acciones">
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
        <h2 className="title-sm">Pendientes</h2>
        <Link to="/cronograma?estado=pendiente">Ver cronograma</Link>
      </div>
      {pendientes.length === 0 ? (
        <div className="card muted">
          No hay pendientes en este {label('trimestre', aliases)}.
        </div>
      ) : (
        <div className="list">
          {pendientes.slice(0, 5).map((item) => renderDashItem(item))}
        </div>
      )}

      <div className="page-head" style={{ marginTop: '1.25rem' }}>
        <h2 className="title-sm">Ejecutadas</h2>
        <Link to="/historicos">Ver histórico</Link>
      </div>
      {ejecutadas.length === 0 ? (
        <div className="card muted">
          Aún no hay ejecuciones en este {label('trimestre', aliases)}.
        </div>
      ) : (
        <div className="list">
          {ejecutadas.slice(0, 5).map((item) => renderDashItem(item))}
        </div>
      )}

      {accionesAbiertas.length > 0 ? (
        <div style={{ marginTop: '1.25rem' }}>
          <div className="page-head">
            <h2 className="title-sm">{accionesTitulo(false, aliases)} abiertas</h2>
            <Link to="/historicos?tab=acciones">Ver correctivas</Link>
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
                  <div className="row-spread" style={{ alignItems: 'flex-start', gap: '0.5rem' }}>
                    <span className="occ-meta" style={{ alignItems: 'flex-start' }}>
                      {tipoAccionOf(a) === 'correctiva' ? (
                        <PrioridadMark prioridad={prioridadOf(a)} iconOnly />
                      ) : null}
                      <strong>{a.texto}</strong>
                    </span>
                    <StatusBadge estado={estadoAgendaCorrectiva(a)} />
                  </div>
                  <div className="muted occ-meta">
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
