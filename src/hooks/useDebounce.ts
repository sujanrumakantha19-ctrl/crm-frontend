import { useState, useEffect } from 'react'

/**
 * Debounces a value by the specified delay (default 500ms).
 * Returns the debounced value that only updates after the delay.
 */
export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}
