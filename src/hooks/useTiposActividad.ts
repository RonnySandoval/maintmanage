import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { TipoActividadDef } from '../db/types'
import { mergeTiposActividad } from '../lib/tiposActividad'

export function useTiposActividad(): TipoActividadDef[] {
  const ajustes = useLiveQuery(() => db.ajustes.get('app'))
  const usados =
    useLiveQuery(async () => {
      const rows = await db.actividades.toArray()
      return [...new Set(rows.map((a) => a.tipo).filter(Boolean))]
    }) ?? []

  return useMemo(
    () => mergeTiposActividad(ajustes?.tiposActividad, usados),
    [ajustes?.tiposActividad, usados],
  )
}
