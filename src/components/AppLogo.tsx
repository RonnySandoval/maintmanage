const base = import.meta.env.BASE_URL

export function AppLogo({ className }: { className?: string }) {
  return (
    <span className={`app-logo${className ? ` ${className}` : ''}`} aria-hidden>
      <img className="app-logo-light" src={`${base}logo-light.png`} alt="" />
      <img className="app-logo-dark" src={`${base}logo-dark.png`} alt="" />
    </span>
  )
}
