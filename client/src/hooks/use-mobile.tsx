import * as React from "react"

const MOBILE_BREAKPOINT = 768

/**
 * Returns true when the viewport width is below the mobile breakpoint (768 px).
 * Listens for viewport changes via matchMedia so the value stays in sync on resize.
 * @returns Boolean indicating whether the current viewport is mobile-sized.
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}
