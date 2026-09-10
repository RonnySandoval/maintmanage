import Dexie, { type Table } from 'dexie'
import type {
  AccionCorrectiva,
  Adjunto,
  Ajustes,
  Encargado,
  Ejecucion,
  Ficha,
  Grupo,
  Ocurrencia,
} from './types'

export class MaintDB extends Dexie {
  encargados!: Table<Encargado, string>
  grupos!: Table<Grupo, string>
  fichas!: Table<Ficha, string>
  ocurrencias!: Table<Ocurrencia, string>
  ejecuciones!: Table<Ejecucion, string>
  accionesCorrectivas!: Table<AccionCorrectiva, string>
  adjuntos!: Table<Adjunto, string>
  ajustes!: Table<Ajustes, string>

  constructor() {
    super('maintmanage')
    this.version(1).stores({
      encargados: 'id, nombre',
      grupos: 'id, nombre',
      fichas: 'id, grupoId, encargadoId, nombre',
      ocurrencias: 'id, fichaId, fechaProgramada, estado, [fichaId+fechaProgramada]',
      ejecuciones: 'id, ocurrenciaId',
      accionesCorrectivas: 'id, fichaId, ocurrenciaId, estado',
      adjuntos: 'id, fichaId, ejecucionId, tipo',
      ajustes: 'id',
    })
  }
}

export const db = new MaintDB()

db.on('ready', async () => {
  const current = await db.ajustes.get('app')
  if (!current) {
    await db.ajustes.put({
      id: 'app',
      umbralProximaDias: 7,
      notificaciones: false,
    })
  }
})
