import Dexie, { type Table } from 'dexie'
import { registerChangeHooks } from '../lib/changeTracker'
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
    this.version(4)
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
        const encargados = tx.table('encargados')
        const fichas = tx.table('fichas')
        const fichaRows = (await fichas.toArray()) as {
          id: string
          encargadoId?: string
          congregacion?: string
        }[]
        for (const ficha of fichaRows) {
          const cong = ficha.congregacion?.trim()
          if (!cong || !ficha.encargadoId) continue
          const enc = (await encargados.get(ficha.encargadoId)) as
            | { congregacion?: string }
            | undefined
          if (enc && !enc.congregacion) {
            await encargados.update(ficha.encargadoId, { congregacion: cong })
          }
        }
        await fichas.toCollection().modify((ficha: { congregacion?: string }) => {
          delete ficha.congregacion
        })
      })
    this.version(5)
      .stores({
        encargados: 'id, nombre',
        grupos: 'id, nombre',
        fichas: 'id, grupoId, encargadoId, nombre, numero',
        ocurrencias: 'id, fichaId, fechaProgramada, estado, [fichaId+fechaProgramada]',
        ejecuciones: 'id, ocurrenciaId',
        accionesCorrectivas: 'id, fichaId, ocurrenciaId, estado, tipo',
        adjuntos: 'id, fichaId, ejecucionId, tipo',
        ajustes: 'id',
      })
      .upgrade(async (tx) => {
        await tx
          .table('accionesCorrectivas')
          .toCollection()
          .modify((accion: { tipo?: string; fechaObjetivo?: string }) => {
            if (accion.tipo === 'recomendacion' || accion.tipo === 'correctiva') return
            accion.tipo = accion.fechaObjetivo ? 'correctiva' : 'recomendacion'
          })
      })
  }
}

export const db = new MaintDB()
registerChangeHooks(db)

db.on('ready', async () => {
  const current = await db.ajustes.get('app')
  if (!current) {
    await db.ajustes.put({
      id: 'app',
      umbralProximaDias: 7,
      notificaciones: false,
      autoBackup: true,
    })
    return
  }
  if (current.autoBackup === undefined) {
    await db.ajustes.update('app', { autoBackup: true })
  }
})
