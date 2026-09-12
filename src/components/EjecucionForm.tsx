import { useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { createId } from '../lib/ids'
import { todayISO } from '../lib/dates'
import { saveAdjuntos } from '../lib/files'
import { refreshEstados } from '../db/occurrences'
import { AttachmentList, removeAdjunto } from './AttachmentList'
import { FilePicker } from './FilePicker'
import { Modal } from './ui'

export function EjecucionForm({
  ocurrenciaId,
  eventoId,
  accionId,
  fichaId,
  actividadId,
  onSaved,
}: {
  ocurrenciaId?: string
  eventoId?: string
  accionId?: string
  fichaId?: string
  actividadId?: string
  onSaved?: () => void
}) {
  const parentId = ocurrenciaId ?? eventoId ?? accionId ?? 'ejec'
  const ejecucion = useLiveQuery(
    () =>
      ocurrenciaId
        ? db.ejecuciones.where('ocurrenciaId').equals(ocurrenciaId).first()
        : eventoId
          ? db.ejecuciones.where('eventoId').equals(eventoId).first()
          : accionId
            ? db.ejecuciones.where('accionId').equals(accionId).first()
            : undefined,
    [ocurrenciaId, eventoId, accionId],
  )
  const evidencia =
    useLiveQuery(
      () => (ejecucion?.id ? db.adjuntos.where('ejecucionId').equals(ejecucion.id).toArray() : []),
      [ejecucion?.id],
    ) ?? []

  const [draft, setDraft] = useState<{
    fechaReal: string
    observaciones: string
    realizadoPor: string
  } | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)

  const fechaReal = draft?.fechaReal ?? ejecucion?.fechaReal ?? todayISO()
  const observaciones = draft?.observaciones ?? ejecucion?.observaciones ?? ''
  const realizadoPor = draft?.realizadoPor ?? ejecucion?.realizadoPor ?? ''

  function patchDraft(partial: Partial<{ fechaReal: string; observaciones: string; realizadoPor: string }>) {
    setDraft({ fechaReal, observaciones, realizadoPor, ...partial })
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!ocurrenciaId && !eventoId && !accionId) return
    setSaving(true)
    try {
      const now = Date.now()
      const ejecucionId = ejecucion?.id ?? createId()
      await db.ejecuciones.put({
        id: ejecucionId,
        ocurrenciaId: ocurrenciaId || undefined,
        eventoId: eventoId || undefined,
        accionId: accionId || undefined,
        fechaReal,
        observaciones: observaciones.trim() || undefined,
        realizadoPor: realizadoPor.trim() || undefined,
        createdAt: ejecucion?.createdAt ?? now,
        updatedAt: now,
      })
      if (files.length) {
        await saveAdjuntos(files, {
          tipo: 'ejecucion',
          ejecucionId,
          fichaId,
          actividadId,
        })
      }
      if (ocurrenciaId) {
        await db.ocurrencias.update(ocurrenciaId, {
          estado: 'ejecutada',
          updatedAt: now,
        })
      }
      if (eventoId) {
        await db.eventos.update(eventoId, {
          estado: 'ejecutada',
          updatedAt: now,
        })
      }
      if (accionId) {
        await db.accionesCorrectivas.update(accionId, {
          estado: 'ejecutada',
          updatedAt: now,
        })
      }
      if (!accionId) await refreshEstados()
      setDraft(null)
      setFiles([])
      onSaved?.()
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(e) => void save(e)}>
      <div className="ficha-form-grid">
        <div className="field">
          <label htmlFor={`fechaReal-${parentId}`}>Fecha real</label>
          <input
            id={`fechaReal-${parentId}`}
            className="input"
            type="date"
            value={fechaReal}
            onChange={(e) => patchDraft({ fechaReal: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor={`realizadoPor-${parentId}`}>Realizado por (opcional)</label>
          <input
            id={`realizadoPor-${parentId}`}
            className="input"
            value={realizadoPor}
            onChange={(e) => patchDraft({ realizadoPor: e.target.value })}
            placeholder="Nombre de quien la hizo"
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor={`obs-${parentId}`}>Observaciones</label>
        <textarea
          id={`obs-${parentId}`}
          className="textarea"
          value={observaciones}
          onChange={(e) => patchDraft({ observaciones: e.target.value })}
          placeholder="Hallazgos, piezas, condiciones…"
        />
      </div>
      <div className="field">
        <label>Evidencia</label>
        <FilePicker
          files={files}
          onFiles={(list) => {
            if (ejecucion) {
              void saveAdjuntos(list, {
                tipo: 'ejecucion',
                ejecucionId: ejecucion.id,
                fichaId,
                actividadId,
              })
              return
            }
            setFiles((prev) => [...prev, ...list])
          }}
          onRemoveFile={(index) => setFiles((prev) => prev.filter((_, i) => i !== index))}
        />
        {ejecucion ? (
          <div style={{ marginTop: '0.75rem' }}>
            <AttachmentList adjuntos={evidencia} onDelete={(adjId) => void removeAdjunto(adjId)} />
          </div>
        ) : null}
      </div>
      <button className="btn btn-primary" type="submit" disabled={saving}>
        {saving ? 'Guardando…' : ejecucion ? 'Guardar cambios' : 'Registrar ejecución'}
      </button>
    </form>
  )
}

export function EjecucionModal({
  open,
  ocurrenciaId,
  eventoId,
  accionId,
  fichaId,
  actividadId,
  onClose,
}: {
  open: boolean
  ocurrenciaId?: string
  eventoId?: string
  accionId?: string
  fichaId?: string
  actividadId?: string
  onClose: () => void
}) {
  return (
    <Modal open={open} title="Editar ejecución" onClose={onClose}>
      <EjecucionForm
        ocurrenciaId={ocurrenciaId}
        eventoId={eventoId}
        accionId={accionId}
        fichaId={fichaId}
        actividadId={actividadId}
        onSaved={onClose}
      />
    </Modal>
  )
}
