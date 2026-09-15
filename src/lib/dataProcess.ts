export type DataProcessStep = {
  id: string
  label: string
  detail: string
}

export type DataProcessRunning = {
  phase: 'running'
  title: string
  steps: DataProcessStep[]
  activeStepId: string
  completing?: boolean
}

export type DataProcessOutcome = {
  phase: 'outcome'
  outcome: 'success' | 'error'
  title: string
  message: string
}

export type DataProcessSession = DataProcessRunning | DataProcessOutcome

/** @deprecated Usar DataProcessSession */
export type DataProcessState = DataProcessRunning

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

/** Tramo [floor, ceiling) del paso activo para animación de progreso indeterminado. */
export function stepProgressBounds(
  steps: DataProcessStep[],
  activeStepId: string,
): { floor: number; ceiling: number } {
  const index = steps.findIndex((s) => s.id === activeStepId)
  const count = steps.length
  if (index < 0 || count === 0) return { floor: 0, ceiling: 92 }

  const floor = Math.round((index / count) * 100)
  if (index >= count - 1) {
    return { floor, ceiling: 96 }
  }

  const nextStart = Math.round(((index + 1) / count) * 100)
  return {
    floor,
    ceiling: Math.max(floor + 6, nextStart - 2),
  }
}
