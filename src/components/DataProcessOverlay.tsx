import { useEffect } from 'react'
import { Check, CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react'
import { stepProgressBounds, type DataProcessSession } from '../lib/dataProcess'
import { useSmoothProgress } from '../hooks/useSmoothProgress'
import { ErrorDetail } from './ErrorDetail'

export function DataProcessOverlay({
  session,
  onDismiss,
}: {
  session: DataProcessSession | null
  onDismiss?: () => void
}) {
  const running = session?.phase === 'running' ? session : null
  const bounds = running
    ? running.completing
      ? { floor: 88, ceiling: 100 }
      : stepProgressBounds(running.steps, running.activeStepId)
    : { floor: 0, ceiling: 100 }
  const progress = useSmoothProgress(bounds.floor, bounds.ceiling, !!running)
  const displayPct = running?.completing ? Math.min(100, Math.round(progress)) : Math.round(progress)

  useEffect(() => {
    if (!session) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [session])

  if (!session) return null

  if (session.phase === 'outcome') {
    const success = session.outcome === 'success'
    return (
      <div
        className="data-process-overlay"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="data-process-outcome-title"
        aria-describedby="data-process-outcome-message"
      >
        <div className={`data-process-panel data-process-panel-outcome is-${session.outcome}`}>
          <div className="data-process-outcome-icon" aria-hidden>
            {success ? <CheckCircle2 size={40} strokeWidth={2} /> : <XCircle size={40} strokeWidth={2} />}
          </div>
          <h2 id="data-process-outcome-title" className="data-process-outcome-title">
            {session.title}
          </h2>
          <p id="data-process-outcome-message" className="data-process-outcome-message">
            {success ? session.message : <ErrorDetail message={session.message} />}
          </p>
          {onDismiss ? (
            <button type="button" className="btn btn-primary data-process-outcome-btn" onClick={onDismiss}>
              Entendido
            </button>
          ) : null}
        </div>
      </div>
    )
  }

  const activeIndex = session.steps.findIndex((s) => s.id === session.activeStepId)
  const activeStep = activeIndex >= 0 ? session.steps[activeIndex] : session.steps[0]

  return (
    <div
      className="data-process-overlay"
      role="dialog"
      aria-modal="true"
      aria-busy="true"
      aria-label={session.title}
    >
      <div className="data-process-panel">
        <div className="data-process-head">
          <div className="data-process-spinner" aria-hidden>
            <Loader2 size={22} className="data-process-spinner-icon" />
          </div>
          <h2 className="data-process-title">{session.title}</h2>
        </div>

        <div className="data-process-progress-wrap">
          <div
            className="progress data-process-progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={displayPct}
            aria-label="Progreso estimado"
          >
            <span style={{ width: `${progress}%` }} />
          </div>
          <p className="data-process-pct">{displayPct}%</p>
        </div>

        <p className="data-process-detail">
          {session.completing ? 'Finalizando…' : activeStep?.detail}
        </p>

        <ol className="data-process-steps">
          {session.steps.map((step, index) => {
            const done = session.completing || (activeIndex >= 0 && index < activeIndex)
            const active = !session.completing && step.id === session.activeStepId
            return (
              <li
                key={step.id}
                className={`data-process-step${done ? ' is-done' : ''}${active ? ' is-active' : ''}`}
              >
                <span className="data-process-step-icon" aria-hidden>
                  {done ? (
                    <Check size={14} strokeWidth={2.75} />
                  ) : active ? (
                    <Loader2 size={14} className="data-process-step-spin" />
                  ) : (
                    <Circle size={8} strokeWidth={2.5} />
                  )}
                </span>
                <span className="data-process-step-label">{step.label}</span>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
