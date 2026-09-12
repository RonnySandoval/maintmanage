import { PanelRight, PanelRightClose } from 'lucide-react'
import { useFilterDrawer } from '../hooks/useFilterDrawer'

export function FilterDrawerToggle() {
  const { available, open, toggle } = useFilterDrawer()
  return (
    <button
      type="button"
      className={`icon-btn${open ? ' is-active' : ''}`}
      aria-label={open ? 'Ocultar herramientas' : 'Mostrar herramientas'}
      aria-pressed={open}
      disabled={!available}
      title={available ? (open ? 'Ocultar herramientas' : 'Mostrar herramientas') : 'Esta vista no tiene filtros'}
      onClick={toggle}
    >
      {open ? <PanelRightClose size={18} /> : <PanelRight size={18} />}
    </button>
  )
}

export function FilterDrawer() {
  const { available, open, title, tools, activeTool, setActiveTool } = useFilterDrawer()
  const current = tools.find((tool) => tool.id === activeTool)

  return (
    <>
      {available && open && current?.content ? (
        <button
          type="button"
          className="filter-drawer-backdrop"
          aria-label="Cerrar panel"
          onClick={() => setActiveTool(null)}
        />
      ) : null}
      <aside
        className={`filter-rail${available && open ? ' is-open' : ''}`}
        aria-hidden={!available || !open}
        aria-label={title}
      >
        {tools.map((tool) => {
          const Icon = tool.icon
          const isActive = activeTool === tool.id || Boolean(tool.active)
          return (
            <button
              key={tool.id}
              type="button"
              className={`filter-rail-btn${isActive ? ' is-active' : ''}`}
              aria-label={tool.label}
              title={tool.label}
              aria-pressed={isActive}
              onClick={() => {
                if (tool.onClick) {
                  tool.onClick()
                  setActiveTool(null)
                  return
                }
                setActiveTool(activeTool === tool.id ? null : tool.id)
              }}
            >
              <Icon size={18} />
            </button>
          )
        })}
      </aside>
      {available && open && current?.content ? (
        <div className="filter-flyout" role="dialog" aria-label={current.label}>
          <div className="filter-flyout-head">
            <strong>{current.label}</strong>
            <button
              type="button"
              className="icon-btn"
              aria-label="Cerrar"
              onClick={() => setActiveTool(null)}
            >
              ×
            </button>
          </div>
          <div className="filter-flyout-body">{current.content}</div>
        </div>
      ) : null}
    </>
  )
}
