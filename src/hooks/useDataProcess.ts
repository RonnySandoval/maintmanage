import { useCallback, useEffect, useRef, useState } from 'react'
import type { DataProcessSession, DataProcessStep } from '../lib/dataProcess'

const COMPLETE_ANIM_MS = 880
const OUTCOME_AUTO_DISMISS_MS = 3400
const OUTCOME_ERROR_DISMISS_MS = 4800

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export type RunProcessOptions<T> = {
  title: string
  steps: DataProcessStep[]
  work: (advance: (stepId: string) => void) => Promise<T>
  successTitle?: string
  successMessage?: string | ((result: T) => string)
  errorTitle?: string
  autoDismissMs?: number
}

export function useDataProcess() {
  const [session, setSession] = useState<DataProcessSession | null>(null)
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const outcomeResolve = useRef<(() => void) | null>(null)

  const clearOutcomeWait = useCallback(() => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current)
    dismissTimer.current = undefined
    const resolve = outcomeResolve.current
    outcomeResolve.current = null
    resolve?.()
  }, [])

  const dismiss = useCallback(() => {
    clearOutcomeWait()
    setSession(null)
  }, [clearOutcomeWait])

  useEffect(
    () => () => {
      clearOutcomeWait()
    },
    [clearOutcomeWait],
  )

  const showOutcome = useCallback(
    (
      outcome: 'success' | 'error',
      title: string,
      message: string,
      autoDismissMs: number,
    ): Promise<void> =>
      new Promise((resolve) => {
        clearOutcomeWait()
        outcomeResolve.current = resolve
        setSession({ phase: 'outcome', outcome, title, message })
        dismissTimer.current = setTimeout(() => {
          dismissTimer.current = undefined
          outcomeResolve.current = null
          setSession(null)
          resolve()
        }, autoDismissMs)
      }),
    [clearOutcomeWait],
  )

  const run = useCallback(
    async <T,>(opts: RunProcessOptions<T>): Promise<T> => {
      clearOutcomeWait()

      const {
        title,
        steps,
        work,
        successTitle,
        successMessage,
        errorTitle,
        autoDismissMs = OUTCOME_AUTO_DISMISS_MS,
      } = opts

      setSession({
        phase: 'running',
        title,
        steps,
        activeStepId: steps[0]?.id ?? '',
      })

      const advance = (stepId: string) => {
        setSession((current) =>
          current?.phase === 'running' ? { ...current, activeStepId: stepId } : current,
        )
      }

      try {
        const result = await work(advance)
        const lastStep = steps[steps.length - 1]?.id ?? ''
        setSession((current) =>
          current?.phase === 'running'
            ? { ...current, activeStepId: lastStep, completing: true }
            : current,
        )
        await sleep(COMPLETE_ANIM_MS)

        const message =
          typeof successMessage === 'function'
            ? successMessage(result)
            : successMessage ?? 'El proceso terminó correctamente.'

        await showOutcome('success', successTitle ?? 'Completado', message, autoDismissMs)
        return result
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'No se pudo completar el proceso.'
        await showOutcome(
          'error',
          errorTitle ?? 'No se pudo completar',
          message,
          autoDismissMs + (OUTCOME_ERROR_DISMISS_MS - OUTCOME_AUTO_DISMISS_MS),
        )
        throw err
      }
    },
    [clearOutcomeWait, showOutcome],
  )

  return { session, run, dismiss }
}
