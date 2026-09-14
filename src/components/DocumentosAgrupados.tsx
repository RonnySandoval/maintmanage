import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import type { Adjunto } from '../db/types'
import { adjuntoImageFiles, adjuntoShareFiles, grupoShareText } from '../lib/adjuntoContext'
import { AttachmentList, removeAdjunto } from './AttachmentList'
import { AdjuntosMark } from './AdjuntosMark'
import { EntityCard } from './EntityCard'
import { ShareMenu } from './ShareMenu'

export type DocumentosGrupo = {
  key: string
  title: ReactNode
  /** Título plano para compartir / lightbox. */
  shareTitle: string
  href?: string
  meta?: string
  adjuntos: Adjunto[]
}

export function DocumentosAgrupados({
  groups,
  emptyText,
  editableTags = true,
}: {
  groups: DocumentosGrupo[]
  emptyText: string
  editableTags?: boolean
}) {
  if (!groups.length) {
    return (
      <div className="table-card">
        <p className="table-empty">{emptyText}</p>
      </div>
    )
  }

  return (
    <div className="docs-grouped">
      {groups.map((group) => {
        const images = adjuntoImageFiles(group.adjuntos)
        const files = images.length ? images : adjuntoShareFiles(group.adjuntos)
        return (
          <EntityCard
            key={group.key}
            className="docs-group"
            title={
              <div className="docs-group-title-block">
                {group.href ? (
                  <Link to={group.href} className="docs-group-link">
                    {group.title}
                  </Link>
                ) : (
                  group.title
                )}
                {group.meta ? <p className="muted docs-group-meta">{group.meta}</p> : null}
              </div>
            }
            badge={
              <div className="docs-group-badge">
                <ShareMenu
                  title={group.shareTitle}
                  text={grupoShareText(group.shareTitle, group.adjuntos)}
                  files={files}
                  iconOnly
                />
                <AdjuntosMark count={group.adjuntos.length} />
              </div>
            }
          >
            <AttachmentList
              adjuntos={group.adjuntos}
              onDelete={(id) => void removeAdjunto(id)}
              editableTags={editableTags}
              parentLabel={group.shareTitle}
            />
          </EntityCard>
        )
      })}
    </div>
  )
}
