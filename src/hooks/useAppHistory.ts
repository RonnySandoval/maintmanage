import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import { locationKey, parentPath } from '../lib/nav'

export function useAppHistory() {
  const location = useLocation()
  const navigate = useNavigate()
  const navType = useNavigationType()
  const stackRef = useRef<string[]>([locationKey(location.pathname, location.search)])
  const indexRef = useRef(0)
  const [canBack, setCanBack] = useState(() => parentPath(location.pathname) !== null)
  const [canForward, setCanForward] = useState(false)

  useEffect(() => {
    const key = locationKey(location.pathname, location.search)
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
        if (found >= 0) {
          indexRef.current = found
        } else {
          stack.splice(i + 1)
          stack.push(key)
          indexRef.current = stack.length - 1
        }
      }
    } else if (stack[i] !== key) {
      stack.splice(i + 1)
      stack.push(key)
      indexRef.current = stack.length - 1
    }

    i = indexRef.current
    setCanBack(i > 0 || parentPath(location.pathname) !== null)
    setCanForward(i < stack.length - 1)
  }, [location, navType])

  function back() {
    if (indexRef.current > 0) {
      navigate(-1)
      return
    }
    const parent = parentPath(location.pathname)
    if (parent) navigate(parent, { replace: true })
  }

  function forward() {
    if (indexRef.current < stackRef.current.length - 1) {
      navigate(1)
    }
  }

  return { canBack, canForward, back, forward }
}
