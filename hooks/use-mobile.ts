import * as React from "react"

const MOBILE_BREAKPOINT = 768

// useSyncExternalStore instead of useEffect+useState: matchMedia is an
// external system (the viewport), so this subscribes to it directly rather
// than mirroring it into React state from inside an effect body (which
// trips react-hooks/set-state-in-effect and causes an extra render on
// mount). getServerSnapshot returns false so SSR/hydration has a stable,
// deterministic value before the real viewport width is known client-side.
function subscribe(callback: () => void) {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  mql.addEventListener("change", callback)
  return () => mql.removeEventListener("change", callback)
}

function getSnapshot() {
  return window.innerWidth < MOBILE_BREAKPOINT
}

function getServerSnapshot() {
  return false
}

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
