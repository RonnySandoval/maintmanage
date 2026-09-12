import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { TipoActividadDef } from '../db/types'
import { applyTipoAliases } from '../lib/labels'
import { mergeTiposActividad } from '../lib/tiposActividad'

export function useTiposActividad(): TipoActividadDef[] {
  const ajustes = useLiveQuery(() => db.ajustes.get('app'))
  const usados =
    useLiveQuery(async () => {
      const rows = await db.actividades.toArray()
      return [...new Set(rows.map((a) => a.tipo).filter(Boolean))]
    }) ?? []

  return useMemo(
    () => applyTipoAliases(mergeTiposActividad(ajustes?.tiposActividad, usados), ajustes?.aliases),
    [ajustes?.tiposActividad, ajustes?.aliases, usados],
  )
}
