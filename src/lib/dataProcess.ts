import type { CloudBackupProgress, CloudRestoreProgress } from '../backup'

export type DataProcessStep = {
  id: string
  label: string
  detail: string
}

export type DataProcessState = {
  title: string
  steps: DataProcessStep[]
  activeStepId: string
}

export const GMAIL_UPLOAD_STEPS: DataProcessStep[] = [
  {
    id: 'preparing',
    label: 'Preparando',
    detail: 'Recopilando datos locales y adjuntos…',
  },
  {
    id: 'compressing',
    label: 'Comprimiendo',
    detail: 'Empaquetando la copia en ZIP…',
  },
  {
    id: 'uploading',
    label: 'Subiendo',
    detail: 'Enviando la copia a tu Gmail…',
  },
]

export const GMAIL_RESTORE_STEPS: DataProcessStep[] = [
  {
    id: 'downloading',
    label: 'Descargando',
    detail: 'Obteniendo la copia desde Gmail…',
  },
  {
    id: 'validating',
    label: 'Validando',
    detail: 'Comprobando integridad y formato…',
  },
  {
    id: 'restoring',
    label: 'Restaurando',
    detail: 'Reemplazando datos en este dispositivo…',
  },
]

export const EXPORT_STEPS: DataProcessStep[] = [
  {
    id: 'collect',
    label: 'Recopilando',
    detail: 'Leyendo actividades, fichas y archivos adjuntos…',
  },
  {
    id: 'pack',
    label: 'Empaquetando',
    detail: 'Comprimiendo la copia…',
  },
  {
    id: 'finish',
    label: 'Finalizando',
    detail: 'Preparando el archivo…',
  },
]

export const IMPORT_STEPS: DataProcessStep[] = [
  {
    id: 'read',
    label: 'Leyendo archivo',
    detail: 'Abriendo y analizando la copia…',
  },
  {
    id: 'validate',
    label: 'Validando',
    detail: 'Comprobando integridad y versión…',
  },
  {
    id: 'apply',
    label: 'Aplicando datos',
    detail: 'Escribiendo en la base local…',
  },
]

export const FOLDER_WRITE_STEPS: DataProcessStep[] = [
  {
    id: 'collect',
    label: 'Recopilando',
    detail: 'Leyendo datos locales…',
  },
  {
    id: 'pack',
    label: 'Empaquetando',
    detail: 'Generando archivo de copia…',
  },
  {
    id: 'write',
    label: 'Escribiendo',
    detail: 'Guardando en la carpeta elegida…',
  },
]

export const FOLDER_RESTORE_STEPS: DataProcessStep[] = [
  {
    id: 'read',
    label: 'Leyendo carpeta',
    detail: 'Localizando el archivo de copia…',
  },
  {
    id: 'validate',
    label: 'Validando',
    detail: 'Comprobando integridad…',
  },
  {
    id: 'apply',
    label: 'Restaurando',
    detail: 'Aplicando datos en este dispositivo…',
  },
]

export const SAVE_BACKUP_STEPS: DataProcessStep[] = [
  {
    id: 'collect',
    label: 'Recopilando',
    detail: 'Leyendo datos locales…',
  },
  {
    id: 'pack',
    label: 'Empaquetando',
    detail: 'Generando la copia…',
  },
  {
    id: 'save',
    label: 'Guardando',
    detail: 'Escribiendo fuera del navegador…',
  },
]

export function gmailUploadProcess(step: CloudBackupProgress | null): DataProcessState | null {
  if (!step || step === 'done' || step === 'error') return null
  return {
    title: 'Creando copia en Gmail',
    steps: GMAIL_UPLOAD_STEPS,
    activeStepId: step,
  }
}

export function gmailRestoreProcess(step: CloudRestoreProgress | null): DataProcessState | null {
  if (!step || step === 'done' || step === 'error') return null
  return {
    title: 'Restaurando desde Gmail',
    steps: GMAIL_RESTORE_STEPS,
    activeStepId: step,
  }
}

export function processProgressPercent(steps: DataProcessStep[], activeStepId: string): number {
  const index = steps.findIndex((s) => s.id === activeStepId)
  if (index < 0) return 8
  const slot = (index + 0.62) / steps.length
  return Math.min(96, Math.max(8, Math.round(slot * 100)))
}
