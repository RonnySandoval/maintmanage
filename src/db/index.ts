import Dexie, { type Table } from 'dexie'
import type {
  AccionCorrectiva,
  Adjunto,
  Ajustes,
  Encargado,
  Ejecucion,
  Bloque,
  Ficha,
  Ocurrencia,
} from './types'

export class MaintDB extends Dexie {
  encargados!: Table<Encargado, string>
  grupos!: Table<Bloque, string>
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
    this.version(2)
      .stores({
        encargados: 'id, nombre',
        grupos: 'id, nombre',
        fichas: 'id, grupoId, encargadoId, nombre, numero',
        ocurrencias: 'id, fichaId, fechaProgramada, estado, [fichaId+fechaProgramada]',
        ejecuciones: 'id, ocurrenciaId',
        accionesCorrectivas: 'id, fichaId, ocurrenciaId, estado',
        adjuntos: 'id, fichaId, ejecucionId, tipo',
        ajustes: 'id',
      })
      .upgrade(async (tx) => {
        await tx
          .table('fichas')
          .toCollection()
          .modify((ficha: { numero?: string }) => {
            if (typeof ficha.numero !== 'string') ficha.numero = ''
          })
      })
    this.version(3)
      .stores({
        encargados: 'id, nombre',
        grupos: 'id, nombre',
        fichas: 'id, grupoId, encargadoId, nombre, numero',
        ocurrencias: 'id, fichaId, fechaProgramada, estado, [fichaId+fechaProgramada]',
        ejecuciones: 'id, ocurrenciaId',
        accionesCorrectivas: 'id, fichaId, ocurrenciaId, estado',
        adjuntos: 'id, fichaId, ejecucionId, tipo',
        ajustes: 'id',
      })
      .upgrade(async (tx) => {
        await tx
          .table('fichas')
          .toCollection()
          .modify(
            (ficha: {
              frecuencia?: string
              fechaPrecision?: string
              encargadoId?: string
            }) => {
              const freq = ficha.frecuencia
              if (freq === 'trimestral') ficha.frecuencia = 'cada_3'
              else if (freq === 'anual') ficha.frecuencia = 'cada_12'
              else if (freq === 'semanal' || freq === 'mensual') ficha.frecuencia = 'cada_1'
              if (ficha.fechaPrecision !== 'dia' && ficha.fechaPrecision !== 'mes') {
                ficha.fechaPrecision = 'mes'
              }
              if (ficha.encargadoId === undefined) ficha.encargadoId = ''
            },
          )
        await tx
          .table('encargados')
          .toCollection()
          .modify((enc: { contacto?: string; telefonos?: string }) => {
            if (!enc.telefonos && enc.contacto) enc.telefonos = enc.contacto
          })
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
