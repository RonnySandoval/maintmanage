import { useCallback, useState } from 'react'
import type { DataProcessState, DataProcessStep } from '../lib/dataProcess'

export function useDataProcess() {
  const [state, setState] = useState<DataProcessState | null>(null)

  const start = useCallback((title: string, steps: DataProcessStep[], firstStepId?: string) => {
    setState({
      title,
      steps,
      activeStepId: firstStepId ?? steps[0]?.id ?? '',
    })
  }, [])

  const advance = useCallback((stepId: string) => {
    setState((prev) => (prev ? { ...prev, activeStepId: stepId } : null))
  }, [])

  const finish = useCallback(() => {
    setState(null)
  }, [])

  const run = useCallback(
    async <T>(
      title: string,
      steps: DataProcessStep[],
      fn: (advance: (stepId: string) => void) => Promise<T>,
    ): Promise<T> => {
      start(title, steps)
      try {
        return await fn(advance)
      } finally {
        finish()
      }
    },
    [start, finish],
  )

  return { state, start, advance, finish, run }
}
