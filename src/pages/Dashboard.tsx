import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarDays, ClipboardList } from 'lucide-react'
import { db } from '../db'
import { addDays, currentMonthPrefix, formatDate, todayISO, weekdayShort } from '../lib/dates'
import { fichaTitulo } from '../lib/fichas'
import { EmptyState, StatusBadge } from '../components/ui'

export function DashboardPage() {
  const navigate = useNavigate()
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

  const today = todayISO()
  const month = currentMonthPrefix()

  const vencidas = ocurrencias.filter((o) => o.estado === 'vencida')
  const proximas = ocurrencias.filter((o) => o.estado === 'proxima')
  const pendientes = ocurrencias.filter((o) => o.estado === 'pendiente')
  const ejecutadasMes = ocurrencias.filter(
    (o) => o.estado === 'ejecutada' && o.fechaProgramada.startsWith(month),
  )
  const delMes = ocurrencias.filter((o) => o.fechaProgramada.startsWith(month))
  const progreso =
    delMes.length === 0
      ? 0
      : Math.round((delMes.filter((o) => o.estado === 'ejecutada').length / delMes.length) * 100)

  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i))
  const byDay = (iso: string) => ocurrencias.filter((o) => o.fechaProgramada === iso)

  const agenda = [...vencidas, ...proximas, ...pendientes]
    .sort((a, b) => a.fechaProgramada.localeCompare(b.fechaProgramada))
    .slice(0, 8)

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
      <div className="kpis">
        <Link className="card kpi card-click" to="/cronograma?estado=vencida">
          <div className="label">Vencidas</div>
          <div className="value" style={{ color: 'var(--danger)' }}>
            {vencidas.length}
          </div>
        </Link>
        <Link className="card kpi card-click" to="/cronograma?estado=proxima">
          <div className="label">Próximas</div>
          <div className="value" style={{ color: 'var(--warning)' }}>
            {proximas.length}
          </div>
        </Link>
        <Link className="card kpi card-click" to="/cronograma?estado=pendiente">
          <div className="label">Pendientes</div>
          <div className="value">{pendientes.length}</div>
        </Link>
        <Link className="card kpi card-click" to="/cronograma?estado=ejecutada">
          <div className="label">Ejecutadas del mes</div>
          <div className="value" style={{ color: 'var(--ok)' }}>
            {ejecutadasMes.length}
          </div>
        </Link>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="row-spread" style={{ marginBottom: '0.55rem' }}>
          <strong>Avance del mes</strong>
          <span className="muted">{progreso}%</span>
        </div>
        <div className="progress" aria-label={`Avance ${progreso} por ciento`}>
          <span style={{ width: `${progreso}%` }} />
        </div>
      </div>

      <div className="week">
        {week.map((iso) => {
          const count = byDay(iso).length
          return (
            <button
              key={iso}
              type="button"
              className={`week-day${iso === today ? ' today' : ''}`}
              onClick={() => navigate(`/cronograma?fecha=${iso}`)}
            >
              <span className="w">{weekdayShort(iso)}</span>
              <span className="d">{iso.slice(8)}</span>
              {count ? <span className="dot-count">{count}</span> : null}
            </button>
          )
        })}
      </div>

      <div className="page-head">
        <h2 className="title-sm">Agenda</h2>
        <Link to="/cronograma">Ver todo</Link>
      </div>
      {agenda.length === 0 ? (
        <div className="card muted">No hay fichas abiertas en el horizonte actual.</div>
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
                    <strong>{ficha ? fichaTitulo(ficha) : 'Ficha'}</strong>
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
          <h2 className="title-sm">Acciones correctivas abiertas</h2>
          <div className="list">
            {acciones.slice(0, 5).map((a) => (
              <div key={a.id} className="card">
                <div className="row-spread">
                  <strong>{a.texto}</strong>
                  <span className="badge badge-pendiente">{a.estado}</span>
                </div>
                <div className="muted">{fichaMap[a.fichaId] ? fichaTitulo(fichaMap[a.fichaId]) : ''}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <p className="muted" style={{ marginTop: '1.2rem', display: 'flex', gap: 8, alignItems: 'center' }}>
        <CalendarDays size={14} /> Datos solo en este navegador. Sincroniza con una copia en Ajustes.
      </p>
    </div>
  )
}
