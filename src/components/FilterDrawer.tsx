import { useEffect, useState } from 'react'
import { Ban, PanelRight, PanelRightClose } from 'lucide-react'
import { useFilterDrawer } from '../hooks/useFilterDrawer'
import { useOverlayPresence } from '../hooks/useOverlayPresence'

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
  const { available, open, title, tools, onClear, canClear, activeTool, setActiveTool } =
    useFilterDrawer()
  const current = tools.find((tool) => tool.id === activeTool)
  const flyoutOpen = Boolean(available && open && current?.content)
  const { mounted: flyoutMounted, shown: flyoutShown, onTransitionEnd } =
    useOverlayPresence(flyoutOpen)
  const [cached, setCached] = useState(current)

  useEffect(() => {
    if (current?.content) setCached(current)
  }, [current])

  const flyout = current?.content ? current : cached

  return (
    <>
      {flyoutMounted ? (
        <button
          type="button"
          className={`filter-drawer-backdrop${flyoutShown ? ' is-open' : ''}`}
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
      {flyoutMounted && flyout?.content ? (
        <div
          className={`filter-flyout${flyoutShown ? ' is-open' : ''}`}
          role="dialog"
          aria-label={flyout.label}
          onTransitionEnd={onTransitionEnd}
        >
          <div className="filter-flyout-head">
            <strong>{flyout.label}</strong>
            <div className="filter-flyout-actions">
              <button
                type="button"
                className={`icon-btn${canClear ? ' is-active' : ''}`}
                aria-label="Borrar filtros"
                title="Borrar filtros"
                disabled={!onClear}
                onClick={() => onClear?.()}
              >
                <Ban size={16} />
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label="Cerrar"
                onClick={() => setActiveTool(null)}
              >
                ×
              </button>
            </div>
          </div>
          <div className="filter-flyout-body">{flyout.content}</div>
        </div>
      ) : null}
    </>
  )
}
