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
  fichaId,
  onSaved,
}: {
  ocurrenciaId: string
  fichaId: string
  onSaved?: () => void
}) {
  const ejecucion = useLiveQuery(
    () => db.ejecuciones.where('ocurrenciaId').equals(ocurrenciaId).first(),
    [ocurrenciaId],
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
    setSaving(true)
    try {
      const now = Date.now()
      const ejecucionId = ejecucion?.id ?? createId()
      await db.ejecuciones.put({
        id: ejecucionId,
        ocurrenciaId,
        fechaReal,
        observaciones: observaciones.trim() || undefined,
        realizadoPor: realizadoPor.trim() || undefined,
        createdAt: ejecucion?.createdAt ?? now,
        updatedAt: now,
      })
      if (files.length) {
        await saveAdjuntos(files, { tipo: 'ejecucion', ejecucionId, fichaId })
      }
      await db.ocurrencias.update(ocurrenciaId, {
        estado: 'ejecutada',
        updatedAt: now,
      })
      await refreshEstados()
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
          <label htmlFor={`fechaReal-${ocurrenciaId}`}>Fecha real</label>
          <input
            id={`fechaReal-${ocurrenciaId}`}
            className="input"
            type="date"
            value={fechaReal}
            onChange={(e) => patchDraft({ fechaReal: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor={`realizadoPor-${ocurrenciaId}`}>Realizado por (opcional)</label>
          <input
            id={`realizadoPor-${ocurrenciaId}`}
            className="input"
            value={realizadoPor}
            onChange={(e) => patchDraft({ realizadoPor: e.target.value })}
            placeholder="Nombre de quien la hizo"
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor={`obs-${ocurrenciaId}`}>Observaciones</label>
        <textarea
          id={`obs-${ocurrenciaId}`}
          className="textarea"
          value={observaciones}
          onChange={(e) => patchDraft({ observaciones: e.target.value })}
          placeholder="Hallazgos, piezas, condiciones…"
        />
      </div>
      <div className="field">
        <label>Evidencia</label>
        <FilePicker
          onFiles={(list) => {
            if (ejecucion) {
              void saveAdjuntos(list, {
                tipo: 'ejecucion',
                ejecucionId: ejecucion.id,
                fichaId,
              })
              return
            }
            setFiles((prev) => [...prev, ...list])
          }}
        />
        {files.length ? <p className="muted">{files.length} archivo(s) por guardar</p> : null}
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
  fichaId,
  onClose,
}: {
  open: boolean
  ocurrenciaId: string
  fichaId: string
  onClose: () => void
}) {
  return (
    <Modal open={open} title="Editar ejecución" onClose={onClose}>
      <EjecucionForm ocurrenciaId={ocurrenciaId} fichaId={fichaId} onSaved={onClose} />
    </Modal>
  )
}
