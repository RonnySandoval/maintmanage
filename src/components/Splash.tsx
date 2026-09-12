import { useEffect, useState } from 'react'
import { AppLogo } from './AppLogo'

const KEY = 'mm-splash'

export function Splash() {
  const [phase, setPhase] = useState<'hide' | 'in' | 'out'>(() => {
    if (typeof sessionStorage === 'undefined') return 'in'
    return sessionStorage.getItem(KEY) ? 'hide' : 'in'
  })

  useEffect(() => {
    if (phase !== 'in') return
    const out = window.setTimeout(() => setPhase('out'), 720)
    const done = window.setTimeout(() => {
      sessionStorage.setItem(KEY, '1')
      setPhase('hide')
    }, 1080)
    return () => {
      window.clearTimeout(out)
      window.clearTimeout(done)
    }
  }, [phase])

  if (phase === 'hide') return null

  return (
    <div className={`splash${phase === 'out' ? ' is-out' : ''}`} aria-hidden>
      <AppLogo className="splash-logo" />
    </div>
  )
}
