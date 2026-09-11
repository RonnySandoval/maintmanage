import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarDays, ClipboardList } from 'lucide-react'
import { db } from '../db'
import { formatDate, inCurrentQuarter, quarterLabel } from '../lib/dates'
import { ESTADOS_CORRECTIVA, tipoAccionLabel, tipoAccionOf } from '../db/types'
import { EmptyState, StatusBadge } from '../components/ui'
import { FichaTitle } from '../components/FichaTitle'

export function DashboardPage() {
  const ocurrencias = useLiveQuery(() => db.ocurrencias.toArray()) ?? []
  const fichas = useLiveQuery(() => db.fichas.toArray()) ?? []
  const bloques = useLiveQuery(() => db.grupos.toArray()) ?? []
  const acciones =
    useLiveQuery(() =>
      db.accionesCorrectivas.where('estado').anyOf(['pendiente', 'programada']).toArray(),
    ) ?? []

  const fichaMap = useMemo(
    () => Object.fromEntries(fichas.map((f) => [f.id, f])),
    [fichas],
  )
  const bloqueMap = useMemo(
    () => Object.fromEntries(bloques.map((b) => [b.id, b])),
    [bloques],
  )

  const trimestre = quarterLabel()
  const delTrimestre = ocurrencias.filter((o) => inCurrentQuarter(o.fechaProgramada))
  const vencidas = delTrimestre.filter((o) => o.estado === 'vencida')
  const proximas = delTrimestre.filter((o) => o.estado === 'proxima')
  const pendientes = delTrimestre.filter((o) => o.estado === 'pendiente')
  const ejecutadas = delTrimestre.filter((o) => o.estado === 'ejecutada')
  const progreso =
    delTrimestre.length === 0
      ? 0
      : Math.round((ejecutadas.length / delTrimestre.length) * 100)

  const agenda = [...delTrimestre].sort((a, b) => a.fechaProgramada.localeCompare(b.fechaProgramada))

  if (!fichas.length) {
    return (
      <EmptyState
        icon={<ClipboardList size={36} />}
        title="Aún no hay fichas"
        text="Crea bloques, encargados y fichas de mantenimiento para ver el cronograma aquí."
        action={
          <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link className="btn" to="/bloques">
              Crear bloque
            </Link>
            <Link className="btn btn-primary" to="/fichas/nueva">
              Crear primera ficha
            </Link>
          </div>
        }
      />
    )
  }

  return (
    <div>
      <p className="muted" style={{ marginTop: 0, marginBottom: '0.7rem' }}>
        Actividad de {trimestre}
      </p>
      <div className="kpis">
        <Link className="card kpi card-click" to="/cronograma?estado=vencida">
          <div className="label">Vencidas</div>
          <div className="value" style={{ color: 'var(--danger)' }}>
            {vencidas.length}
          </div>
        </Link>
        <Link className="card kpi card-click" to="/cronograma?estado=proxima">
          <div className="label">Programadas</div>
          <div className="value" style={{ color: 'var(--warning)' }}>
            {proximas.length}
          </div>
        </Link>
        <Link className="card kpi card-click" to="/cronograma?estado=pendiente">
          <div className="label">Pendientes</div>
          <div className="value">{pendientes.length}</div>
        </Link>
        <Link className="card kpi card-click" to="/cronograma?estado=ejecutada">
          <div className="label">Ejecutadas</div>
          <div className="value" style={{ color: 'var(--ok)' }}>
            {ejecutadas.length}
          </div>
        </Link>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="row-spread" style={{ marginBottom: '0.55rem' }}>
          <strong>Avance del trimestre</strong>
          <span className="muted">{progreso}%</span>
        </div>
        <div className="progress" aria-label={`Avance ${progreso} por ciento`}>
          <span style={{ width: `${progreso}%` }} />
        </div>
      </div>

      <div className="page-head">
        <h2 className="title-sm">Agenda de {trimestre}</h2>
        <Link to="/cronograma">Ver cronograma</Link>
      </div>
      {agenda.length === 0 ? (
        <div className="card muted">No hay actividades en este trimestre.</div>
      ) : (
        <div className="list">
          {agenda.map((o) => {
            const ficha = fichaMap[o.fichaId]
            const bloque = ficha ? bloqueMap[ficha.grupoId] : undefined
            return (
              <Link key={o.id} className="card card-click item" to={`/ocurrencias/${o.id}`}>
                <span className="bar" style={{ background: bloque?.color ?? 'var(--accent)' }} />
                <div className="grow">
                  <div className="row-spread">
                    <strong>
                      <FichaTitle ficha={ficha} color={bloque?.color} />
                    </strong>
                    <StatusBadge estado={o.estado} />
                  </div>
                  <div className="muted">
                    {formatDate(o.fechaProgramada)}
                    {bloque ? ` · ${bloque.nombre}` : ''}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {acciones.length > 0 ? (
        <div style={{ marginTop: '1.25rem' }}>
          <div className="page-head">
            <h2 className="title-sm">Acciones y recomendaciones abiertas</h2>
            <Link to="/historicos">Ver histórico</Link>
          </div>
          <div className="list">
            {acciones.slice(0, 5).map((a) => {
              const ficha = fichaMap[a.fichaId]
              const bloque = ficha ? bloqueMap[ficha.grupoId] : undefined
              return (
                <Link
                  key={a.id}
                  className="card card-click"
                  to={a.ocurrenciaId ? `/ocurrencias/${a.ocurrenciaId}` : `/fichas/${a.fichaId}`}
                >
                  <div className="row-spread">
                    <strong>{a.texto}</strong>
                    <span className={`badge badge-${a.estado}`}>
                      {ESTADOS_CORRECTIVA.find((s) => s.id === a.estado)?.label ?? a.estado}
                    </span>
                  </div>
                  <div className="muted">
                    {tipoAccionLabel(tipoAccionOf(a))} ·{' '}
                    <FichaTitle ficha={ficha} color={bloque?.color} />
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      ) : null}

      <p className="muted" style={{ marginTop: '1.2rem', display: 'flex', gap: 8, alignItems: 'center' }}>
        <CalendarDays size={14} /> Datos solo en este navegador. Sincroniza con una copia en Ajustes.
      </p>
    </div>
  )
}
