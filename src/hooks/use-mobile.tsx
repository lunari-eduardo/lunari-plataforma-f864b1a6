import * as React from "react"

const MOBILE_BREAKPOINT = 768

// Detect common tablet user agents to force non-mobile layout (sidebar)
function isTabletUserAgent() {
  if (typeof navigator === "undefined") return false
  const ua = navigator.userAgent || (navigator as any).vendor || ""
  return /iPad|Android(?!.*Mobile)|Tablet|SM-T|Kindle|Silk|PlayBook/i.test(ua)
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return false
    if (isTabletUserAgent()) return false
    return window.innerWidth < MOBILE_BREAKPOINT
  })

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const sync = () => {
      if (isTabletUserAgent()) {
        setIsMobile(false)
      } else {
        setIsMobile(mql.matches)
      }
    }
    sync()
    const onChange = () => sync()
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return isMobile
}
