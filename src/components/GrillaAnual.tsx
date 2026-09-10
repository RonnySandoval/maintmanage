import { Link } from 'react-router-dom'
import type { Bloque, EstadoOcurrencia, Ficha, Ocurrencia } from '../db/types'
import { fichaTitulo } from '../lib/fichas'

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const TRIMESTRES = [
  { id: 'T1', label: '1.er trim.', months: [0, 1, 2] },
  { id: 'T2', label: '2.º trim.', months: [3, 4, 5] },
  { id: 'T3', label: '3.er trim.', months: [6, 7, 8] },
  { id: 'T4', label: '4.º trim.', months: [9, 10, 11] },
]

const PRIORIDAD: Record<EstadoOcurrencia, number> = {
  vencida: 0,
  proxima: 1,
  pendiente: 2,
  ejecutada: 3,
}

function pickOcc(list: Ocurrencia[]): Ocurrencia | undefined {
  return [...list].sort((a, b) => PRIORIDAD[a.estado] - PRIORIDAD[b.estado])[0]
}

export function GrillaAnual({
  year,
  fichas,
  bloques,
  ocurrencias,
}: {
  year: number
  fichas: Ficha[]
  bloques: Bloque[]
  ocurrencias: Ocurrencia[]
}) {
  const byFichaMonth = new Map<string, Ocurrencia[]>()
  for (const o of ocurrencias) {
    if (!o.fechaProgramada.startsWith(String(year))) continue
    const month = Number(o.fechaProgramada.slice(5, 7)) - 1
    const key = `${o.fichaId}:${month}`
    const list = byFichaMonth.get(key) ?? []
    list.push(o)
    byFichaMonth.set(key, list)
  }

  const bloqueMap = Object.fromEntries(bloques.map((b) => [b.id, b]))
  const groups = new Map<string, Ficha[]>()
  for (const ficha of fichas) {
    const list = groups.get(ficha.grupoId) ?? []
    list.push(ficha)
    groups.set(ficha.grupoId, list)
  }

  const orderedBloques = [
    ...bloques.filter((b) => groups.has(b.id)),
    ...[...groups.keys()]
      .filter((id) => !bloqueMap[id])
      .map((id) => ({ id, nombre: 'Sin bloque', color: 'var(--accent)', createdAt: 0, updatedAt: 0 })),
  ]

  if (!fichas.length) {
    return <div className="card muted">No hay fichas para este año.</div>
  }

  return (
    <div className="year-grid-wrap">
      <table className="year-grid">
        <thead>
          <tr>
            <th className="ficha-col" rowSpan={2}>
              Ficha
            </th>
            {TRIMESTRES.map((t) => (
              <th key={t.id} className="q-head" colSpan={t.months.length}>
                {t.label}
              </th>
            ))}
          </tr>
          <tr>
            {MESES.map((m) => (
              <th key={m}>{m}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orderedBloques.map((bloque) => {
            const rows = (groups.get(bloque.id) ?? []).sort((a, b) => {
              const na = Number.parseInt(a.numero, 10)
              const nb = Number.parseInt(b.numero, 10)
              if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb
              return fichaTitulo(a).localeCompare(fichaTitulo(b), 'es')
            })
            if (!rows.length) return null
            return (
              <BloqueRows key={bloque.id} bloque={bloque} fichas={rows} byFichaMonth={byFichaMonth} />
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function BloqueRows({
  bloque,
  fichas,
  byFichaMonth,
}: {
  bloque: Bloque
  fichas: Ficha[]
  byFichaMonth: Map<string, Ocurrencia[]>
}) {
  return (
    <>
      <tr className="bloque-row">
        <td colSpan={13}>
          <span className="color-dot" style={{ background: bloque.color, margin: '0 8px 0 0' }} />
          {bloque.nombre}
        </td>
      </tr>
      {fichas.map((ficha) => (
        <tr key={ficha.id}>
          <th className="ficha-col" scope="row">
            <Link to={`/fichas/${ficha.id}`}>{fichaTitulo(ficha)}</Link>
          </th>
          {MESES.map((_, month) => {
            const occ = pickOcc(byFichaMonth.get(`${ficha.id}:${month}`) ?? [])
            if (!occ) return <td key={month} />
            return (
              <td key={month}>
                <Link
                  className={`grid-cell ${occ.estado}`}
                  to={`/ocurrencias/${occ.id}`}
                  title={occ.estado}
                >
                  {occ.estado === 'ejecutada'
                    ? 'OK'
                    : occ.estado === 'vencida'
                      ? 'Ven'
                      : occ.estado === 'proxima'
                        ? 'Próx'
                        : '•'}
                </Link>
              </td>
            )
          })}
        </tr>
      ))}
    </>
  )
}
