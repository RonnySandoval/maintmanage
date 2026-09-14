import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import { isDashboard, locationKey } from '../lib/nav'

const MAX_STACK = 20

export function useAppHistory() {
  const location = useLocation()
  const navigate = useNavigate()
  const navType = useNavigationType()
  const stackRef = useRef<string[]>(['/'])
  const indexRef = useRef(0)
  const skipSyncRef = useRef(false)
  const [canBack, setCanBack] = useState(false)
  const [canForward, setCanForward] = useState(false)

  useEffect(() => {
    const key = locationKey(location.pathname, location.search)
    const onDash = isDashboard(location.pathname)

    if (onDash) {
      stackRef.current = ['/']
      indexRef.current = 0
      skipSyncRef.current = false
      setCanBack(false)
      setCanForward(false)
      return
    }

    if (skipSyncRef.current) {
      skipSyncRef.current = false
      setCanBack(true)
      setCanForward(indexRef.current < stackRef.current.length - 1)
      return
    }

    const stack = stackRef.current
    let i = indexRef.current

    if (navType === 'REPLACE') {
      stack[i] = key
      stack.splice(i + 1)
    } else if (navType === 'POP') {
      if (i > 0 && stack[i - 1] === key) {
        indexRef.current = i - 1
      } else if (i < stack.length - 1 && stack[i + 1] === key) {
        indexRef.current = i + 1
      } else {
        const found = stack.lastIndexOf(key)
        if (found >= 0) indexRef.current = found
        else {
          stack.splice(i + 1)
          stack.push(key)
          indexRef.current = stack.length - 1
        }
      }
    } else if (stack[i] !== key) {
      stack.splice(i + 1)
      stack.push(key)
      if (stack[0] !== '/') stack.unshift('/')
      if (stack.length > MAX_STACK) stack.splice(1, stack.length - MAX_STACK)
      indexRef.current = stack.length - 1
    }

    i = indexRef.current
    setCanBack(true)
    setCanForward(i < stack.length - 1)
  }, [location, navType])

  function back() {
    if (isDashboard(location.pathname)) return
    const i = indexRef.current
    if (i > 0) {
      skipSyncRef.current = true
      indexRef.current = i - 1
      navigate(stackRef.current[i - 1], { replace: true })
      return
    }
    skipSyncRef.current = true
    navigate('/', { replace: true })
  }

  function forward() {
    if (indexRef.current >= stackRef.current.length - 1) return
    skipSyncRef.current = true
    indexRef.current += 1
    navigate(stackRef.current[indexRef.current], { replace: true })
  }

  return { canBack, canForward, back, forward }
}
