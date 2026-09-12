import { ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react'

export function SortHeader({
  label,
  active,
  dir,
  onClick,
  className,
}: {
  label: string
  active: boolean
  dir: 'asc' | 'desc'
  onClick: () => void
  className?: string
}) {
  const next = active && dir === 'asc' ? 'Z a A' : 'A a Z'
  return (
    <button
      type="button"
      className={`sort-head${active ? ' is-active' : ''}${className ? ` ${className}` : ''}`}
      onClick={onClick}
      aria-label={`Ordenar ${label} ${next}`}
      title={`Ordenar ${label} ${next}`}
    >
      <span>{label}</span>
      {active ? (
        dir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
      ) : (
        <ArrowUpDown size={14} />
      )}
    </button>
  )
}
