import { useEffect, useState } from 'react'

const DEFAULT_DELAY_MS = 300


export function useDebouncedValue<T>(value: T, delayMs: number = DEFAULT_DELAY_MS): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = window.setTimeout(() => {
      setDebounced(value)
    }, delayMs)
    return () => {
      window.clearTimeout(id)
    }
  }, [value, delayMs])
  return debounced
}
