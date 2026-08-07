import { useEffect, useState, type ReactNode } from 'react'
import {
  isViewportSupported,
  MIN_SUPPORTED_VIEWPORT_WIDTH,
  VIEWPORT_BLOCKER_MESSAGE,
} from './viewport-policy.ts'

type ViewportGateProps = {
  children: ReactNode
}

export function ViewportGate({ children }: ViewportGateProps) {
  const [supported, setSupported] = useState(() =>
    isViewportSupported(window.innerWidth),
  )

  useEffect(() => {
    const handleResize = () => {
      setSupported(isViewportSupported(window.innerWidth))
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <div className="min-h-full">
      <div
        className={supported ? 'min-h-full' : 'pointer-events-none min-h-full invisible'}
        aria-hidden={!supported}
        inert={supported ? undefined : true}
      >
        {children}
      </div>
      {!supported ? (
        <div
          className="fixed inset-0 z-50 grid place-content-center bg-background p-8 text-center text-foreground"
          role="alert"
          aria-live="assertive"
          data-testid="viewport-blocker"
        >
          <p className="mx-auto max-w-md text-base">{VIEWPORT_BLOCKER_MESSAGE}</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Supported width: {MIN_SUPPORTED_VIEWPORT_WIDTH}px or wider.
          </p>
        </div>
      ) : null}
    </div>
  )
}
