"use client"

import { useEffect, useState } from "react"

/**
 * Returns a debounced version of `value` that only updates after `delay` ms
 * of no changes. Use this to throttle search requests.
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}
