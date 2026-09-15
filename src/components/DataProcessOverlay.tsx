import { useEffect } from 'react'
import { Check, Circle, Loader2 } from 'lucide-react'
import {
  processProgressPercent,
  type DataProcessState,
} from '../lib/dataProcess'

export function DataProcessOverlay({ state }: { state: DataProcessState | null }) {
  useEffect(() => {
    if (!state) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [state])

  if (!state) return null

  const activeIndex = state.steps.findIndex((s) => s.id === state.activeStepId)
  const activeStep = activeIndex >= 0 ? state.steps[activeIndex] : state.steps[0]
  const progress = processProgressPercent(state.steps, state.activeStepId)

  return (
    <div
      className="data-process-overlay"
      role="dialog"
      aria-modal="true"
      aria-busy="true"
      aria-label={state.title}
    >
      <div className="data-process-panel">
        <div className="data-process-head">
          <div className="data-process-spinner" aria-hidden>
            <Loader2 size={22} className="data-process-spinner-icon" />
          </div>
          <h2 className="data-process-title">{state.title}</h2>
        </div>

        <div className="data-process-progress-wrap">
          <div className="progress data-process-progress" aria-hidden>
            <span style={{ width: `${progress}%` }} />
          </div>
          <p className="data-process-pct">{progress}%</p>
        </div>

        <p className="data-process-detail">{activeStep?.detail}</p>

        <ol className="data-process-steps">
          {state.steps.map((step, index) => {
            const done = activeIndex >= 0 && index < activeIndex
            const active = step.id === state.activeStepId
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
