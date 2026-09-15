import { useEffect, useMemo, useState } from 'react'
import { Camera, FileText, Images, Paperclip, Trash2 } from 'lucide-react'
import { fileKind } from '../lib/files'
import { ImageLightbox } from './ImageLightbox'

const ACCEPT =
  'image/*,.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export function PendingFileThumbs({
  files,
  onRemove,
}: {
  files: File[]
  onRemove?: (index: number) => void
}) {
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null)
  const imageKeys = useMemo(
    () =>
      files
        .map((file, index) =>
          fileKind(file.type, file.name) === 'image' ? `${index}:${file.name}:${file.size}` : '',
        )
        .filter(Boolean)
        .join('|'),
    [files],
  )
  const urls = useMemo(
    () =>
      files.map((file) =>
        fileKind(file.type, file.name) === 'image' ? URL.createObjectURL(file) : '',
      ),
    [files, imageKeys],
  )

  useEffect(() => {
    return () => {
      for (const url of urls) {
        if (url) URL.revokeObjectURL(url)
      }
    }
  }, [urls])

  if (!files.length) return null

  return (
    <>
      <div className="thumbs" style={{ marginTop: '0.65rem' }}>
        {files.map((file, index) => {
          const kind = fileKind(file.type, file.name)
          const url = urls[index]
          return (
            <div key={`${file.name}-${file.size}-${index}`} className="thumb" style={{ position: 'relative' }}>
              {kind === 'image' && url ? (
                <button
                  type="button"
                  className="thumb-open"
                  onClick={() => setLightbox({ src: url, alt: file.name })}
                  title={`Ver ${file.name}`}
                >
                  <img src={url} alt={file.name} />
                </button>
              ) : kind === 'pdf' ? (
                <FileText size={22} />
              ) : (
                <Paperclip size={22} />
              )}
              <span style={{ wordBreak: 'break-all' }}>{file.name}</span>
              {onRemove ? (
                <button
                  type="button"
                  className="icon-btn icon-btn-delete"
                  style={{ position: 'absolute', top: 0, right: 0 }}
                  aria-label={`Quitar ${file.name}`}
                  onClick={() => onRemove(index)}
                >
                  <Trash2 size={14} />
                </button>
              ) : null}
            </div>
          )
        })}
      </div>
      {lightbox ? (
        <ImageLightbox
          src={lightbox.src}
          alt={lightbox.alt}
          onClose={() => setLightbox(null)}
        />
      ) : null}
    </>
  )
}

export function FilePicker({
  onFiles,
  multiple = true,
  files,
  onRemoveFile,
}: {
  onFiles: (files: File[]) => void
  multiple?: boolean
  files?: File[]
  onRemoveFile?: (index: number) => void
}) {
  function handle(list: FileList | null) {
    if (!list?.length) return
    onFiles(Array.from(list))
  }

  return (
    <div className="file-picker">
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <label className="btn">
          <Images size={16} />
          Galería
          <input
            className="sr-only"
            type="file"
            accept="image/*"
            multiple={multiple}
            onChange={(e) => {
              handle(e.target.files)
              e.target.value = ''
            }}
          />
        </label>
        <label className="btn">
          <Paperclip size={16} />
          Adjuntar
          <input
            className="sr-only"
            type="file"
            accept={ACCEPT}
            multiple={multiple}
            onChange={(e) => {
              handle(e.target.files)
              e.target.value = ''
            }}
          />
        </label>
        <label className="btn">
          <Camera size={16} />
          Cámara
          <input
            className="sr-only"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => {
              handle(e.target.files)
              e.target.value = ''
            }}
          />
        </label>
      </div>
      {files?.length ? <PendingFileThumbs files={files} onRemove={onRemoveFile} /> : null}
    </div>
  )
}
