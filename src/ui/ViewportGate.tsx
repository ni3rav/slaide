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
    <div className="viewport-gate">
      <div
        className="viewport-gate__content"
        aria-hidden={!supported}
        inert={supported ? undefined : true}
      >
        {children}
      </div>
      {!supported ? (
        <div
          className="viewport-blocker"
          role="alert"
          aria-live="assertive"
          data-testid="viewport-blocker"
        >
          <p>{VIEWPORT_BLOCKER_MESSAGE}</p>
          <p className="viewport-blocker__hint">
            Supported width: {MIN_SUPPORTED_VIEWPORT_WIDTH}px or wider.
          </p>
        </div>
      ) : null}
    </div>
  )
}
