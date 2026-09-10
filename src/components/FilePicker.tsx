import { Camera, Paperclip } from 'lucide-react'

const ACCEPT =
  'image/*,.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export function FilePicker({
  onFiles,
  multiple = true,
}: {
  onFiles: (files: File[]) => void
  multiple?: boolean
}) {
  function handle(list: FileList | null) {
    if (!list?.length) return
    onFiles(Array.from(list))
  }

  return (
    <div className="row" style={{ flexWrap: 'wrap' }}>
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
  )
}
