import Dexie, { type Table } from 'dexie'
import { registerChangeHooks } from '../lib/changeTracker'
import type {
  AccionCorrectiva,
  Actividad,
  Adjunto,
  Ajustes,
  Encargado,
  Ejecucion,
  Evento,
  Bloque,
  Ficha,
  Nota,
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
  actividades!: Table<Actividad, string>
  eventos!: Table<Evento, string>
  notas!: Table<Nota, string>

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
    this.version(6)
      .stores({
        encargados: 'id, nombre',
        grupos: 'id, nombre',
        fichas: 'id, grupoId, encargadoId, nombre, numero',
        ocurrencias: 'id, fichaId, fechaProgramada, estado, origen, [fichaId+fechaProgramada]',
        ejecuciones: 'id, ocurrenciaId',
        accionesCorrectivas: 'id, fichaId, ocurrenciaId, estado, tipo',
        adjuntos: 'id, fichaId, ejecucionId, tipo',
        ajustes: 'id',
      })
      .upgrade(async (tx) => {
        await tx
          .table('ocurrencias')
          .toCollection()
          .modify((occ: { origen?: string }) => {
            if (occ.origen !== 'extraordinaria') occ.origen = 'programada'
          })
      })
    this.version(7)
      .stores({
        encargados: 'id, nombre',
        grupos: 'id, nombre',
        fichas: 'id, grupoId, encargadoId, nombre, numero',
        ocurrencias: 'id, fichaId, fechaProgramada, estado, origen, [fichaId+fechaProgramada]',
        ejecuciones: 'id, ocurrenciaId',
        accionesCorrectivas: 'id, fichaId, ocurrenciaId, estado, tipo, prioridad',
        adjuntos: 'id, fichaId, ejecucionId, tipo',
        ajustes: 'id',
      })
      .upgrade(async (tx) => {
        await tx
          .table('accionesCorrectivas')
          .toCollection()
          .modify((accion: { prioridad?: string }) => {
            if (accion.prioridad !== 'alta' && accion.prioridad !== 'baja') {
              accion.prioridad = 'media'
            }
          })
      })
    this.version(8).stores({
      encargados: 'id, nombre',
      grupos: 'id, nombre',
      fichas: 'id, grupoId, encargadoId, nombre, numero',
      ocurrencias: 'id, fichaId, fechaProgramada, estado, origen, [fichaId+fechaProgramada]',
      ejecuciones: 'id, ocurrenciaId, eventoId',
      accionesCorrectivas: 'id, fichaId, ocurrenciaId, estado, tipo, prioridad',
      adjuntos: 'id, fichaId, ejecucionId, tipo, actividadId',
      ajustes: 'id',
      actividades: 'id, tipo, encargadoId, titulo',
      eventos: 'id, actividadId, fechaProgramada, estado, origen, [actividadId+fechaProgramada]',
    })
    this.version(9).stores({
      encargados: 'id, nombre',
      grupos: 'id, nombre',
      fichas: 'id, grupoId, encargadoId, nombre, numero',
      ocurrencias: 'id, fichaId, fechaProgramada, estado, origen, [fichaId+fechaProgramada]',
      ejecuciones: 'id, ocurrenciaId, eventoId',
      accionesCorrectivas:
        'id, fichaId, ocurrenciaId, actividadId, eventoId, estado, tipo, prioridad',
      adjuntos: 'id, fichaId, ejecucionId, tipo, actividadId',
      ajustes: 'id',
      actividades: 'id, tipo, encargadoId, titulo',
      eventos: 'id, actividadId, fechaProgramada, estado, origen, [actividadId+fechaProgramada]',
    })
    this.version(10).stores({
      encargados: 'id, nombre',
      grupos: 'id, nombre',
      fichas: 'id, grupoId, encargadoId, nombre, numero',
      ocurrencias: 'id, fichaId, fechaProgramada, estado, origen, [fichaId+fechaProgramada]',
      ejecuciones: 'id, ocurrenciaId, eventoId, accionId',
      accionesCorrectivas:
        'id, fichaId, ocurrenciaId, actividadId, eventoId, estado, tipo, prioridad',
      adjuntos: 'id, fichaId, ejecucionId, tipo, actividadId',
      ajustes: 'id',
      actividades: 'id, tipo, encargadoId, titulo',
      eventos: 'id, actividadId, fechaProgramada, estado, origen, [actividadId+fechaProgramada]',
    })
    this.version(11).stores({
      encargados: 'id, nombre',
      grupos: 'id, nombre',
      fichas: 'id, grupoId, encargadoId, nombre, numero',
      ocurrencias: 'id, fichaId, fechaProgramada, estado, origen, [fichaId+fechaProgramada]',
      ejecuciones: 'id, ocurrenciaId, eventoId, accionId',
      accionesCorrectivas:
        'id, fichaId, ocurrenciaId, actividadId, eventoId, estado, tipo, prioridad',
      adjuntos: 'id, fichaId, ejecucionId, tipo, actividadId',
      ajustes: 'id',
      actividades: 'id, tipo, encargadoId, titulo',
      eventos: 'id, actividadId, fechaProgramada, estado, origen, [actividadId+fechaProgramada]',
      notas: 'id, fichaId, ocurrenciaId, updatedAt',
    })
    this.version(12)
      .stores({
        encargados: 'id, nombre',
        grupos: 'id, nombre',
        fichas: 'id, grupoId, encargadoId, nombre, numero',
        ocurrencias: 'id, fichaId, fechaProgramada, estado, origen, [fichaId+fechaProgramada]',
        ejecuciones: 'id, ocurrenciaId, eventoId, accionId',
        accionesCorrectivas:
          'id, fichaId, ocurrenciaId, actividadId, eventoId, estado, tipo, prioridad',
        adjuntos: 'id, fichaId, ejecucionId, tipo, actividadId',
        ajustes: 'id',
        actividades: 'id, tipo, encargadoId, titulo',
        eventos: 'id, actividadId, fechaProgramada, estado, origen, [actividadId+fechaProgramada]',
        notas: 'id, fichaId, ocurrenciaId, updatedAt, fecha',
      })
      .upgrade(async (tx) => {
        await tx
          .table('notas')
          .toCollection()
          .modify((nota: { fecha?: string; createdAt?: number }) => {
            if (typeof nota.fecha !== 'string' || !nota.fecha) {
              const base = typeof nota.createdAt === 'number' ? new Date(nota.createdAt) : new Date()
              nota.fecha = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`
            }
          })
      })
    this.version(13).stores({
      encargados: 'id, nombre',
      grupos: 'id, nombre',
      fichas: 'id, grupoId, encargadoId, nombre, numero',
      ocurrencias: 'id, fichaId, fechaProgramada, estado, origen, [fichaId+fechaProgramada]',
      ejecuciones: 'id, ocurrenciaId, eventoId, accionId',
      accionesCorrectivas:
        'id, fichaId, ocurrenciaId, actividadId, eventoId, estado, tipo, prioridad',
      adjuntos: 'id, fichaId, ejecucionId, tipo, actividadId',
      ajustes: 'id',
      actividades: 'id, tipo, encargadoId, titulo',
      eventos: 'id, actividadId, fechaProgramada, estado, origen, [actividadId+fechaProgramada]',
      notas: 'id, fichaId, ocurrenciaId, actividadId, eventoId, updatedAt, fecha',
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
