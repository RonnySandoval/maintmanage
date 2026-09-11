export function ColorPicker({
  id,
  value,
  onChange,
  label = 'Color',
  compact = false,
}: {
  id?: string
  value: string
  onChange: (color: string) => void
  label?: string
  compact?: boolean
}) {
  const hex = /^#[0-9A-Fa-f]{6}$/.test(value) ? value : '#0f766e'

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <input
          id={id}
          className="color-native"
          type="color"
          value={hex}
          onChange={(e) => onChange(e.target.value)}
          title="Abrir paleta de colores"
          aria-label="Paleta de colores"
        />
        <input
          className="input"
          style={{ maxWidth: 110 }}
          value={hex}
          onChange={(e) => {
            const next = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`
            onChange(next)
          }}
          spellCheck={false}
          aria-label="Código de color"
        />
        <span className="color-swatch" style={{ background: hex }} aria-hidden />
      </div>
      {compact ? null : (
        <p className="muted" style={{ margin: 0 }}>
          Pulsa el recuadro para abrir la paleta completa del sistema.
        </p>
      )}
    </div>
  )
}
