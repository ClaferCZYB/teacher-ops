/**
 * 自适应桌面 / 移动端外壳
 */
import { ReactNode, useEffect, useState } from 'react'
import { DesktopShell } from './DesktopShell'
import { MobileShell } from './MobileShell'

const MOBILE_BREAKPOINT = 768

function useIsMobile(): boolean {
  const [m, setM] = useState<boolean>(() =>
    typeof window === 'undefined' ? false : window.innerWidth < MOBILE_BREAKPOINT,
  )
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = (e: MediaQueryListEvent) => setM(e.matches)
    setM(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return m
}

export function AppShell({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile()
  return isMobile ? <MobileShell>{children}</MobileShell> : <DesktopShell>{children}</DesktopShell>
}
