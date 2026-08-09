import { useEffect, useRef } from 'react'
import { LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PREVIEW_CLOSE_DURATION_MS } from './constants.ts'

export type SlidePreviewPanelState =
  | 'loading'
  | 'ready'
  | 'error'
  | 'closing'

type SlidePreviewPanelProps = {
  slideNumber: number
  state: SlidePreviewPanelState
  imageUrl: string | null
  onRetry: () => void
  onCloseComplete: () => void
}

export function SlidePreviewPanel({
  slideNumber,
  state,
  imageUrl,
  onRetry,
  onCloseComplete,
}: SlidePreviewPanelProps) {
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (state !== 'closing') return

    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null
      onCloseComplete()
    }, PREVIEW_CLOSE_DURATION_MS)

    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current)
        closeTimerRef.current = null
      }
    }
  }, [onCloseComplete, state])

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-md bg-card transition-opacity duration-200 ease-out motion-reduce:transition-none"
      style={{ opacity: state === 'closing' ? 0 : 1 }}
      data-testid="slide-preview-panel"
      data-preview-state={state}
      aria-label={`Preview for slide ${slideNumber}`}
    >
      {state === 'loading' ? (
        <div className="flex size-full items-center justify-center">
          <LoaderCircle
            className="size-5 animate-spin text-muted-foreground"
            aria-hidden="true"
          />
          <span className="sr-only">Generating preview</span>
        </div>
      ) : null}
      {state === 'error' ? (
        <div className="pointer-events-auto flex size-full flex-col items-center justify-center gap-2 p-3 text-center">
          <p className="m-0 text-xs text-destructive">Preview failed</p>
          <Button type="button" size="sm" variant="outline" onClick={onRetry}>
            Retry
          </Button>
        </div>
      ) : null}
      {(state === 'ready' || state === 'closing') && imageUrl ? (
        <img
          src={imageUrl}
          alt={`Slide ${slideNumber} preview`}
          className="size-full object-contain"
          data-testid="slide-preview-image"
          width={1920}
          height={1080}
        />
      ) : null}
    </div>
  )
}
