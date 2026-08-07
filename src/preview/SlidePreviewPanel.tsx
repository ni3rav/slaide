import { useEffect, useRef, useState } from 'react'
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
  const [expanded, setExpanded] = useState(false)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setExpanded(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    if (state !== 'closing') return

    setExpanded(false)
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
      className="col-span-full grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none"
      style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
      data-testid="slide-preview-panel"
      data-preview-state={state}
      aria-label={`Preview for slide ${slideNumber}`}
    >
      <div className="overflow-hidden">
        <div className="pb-1 pl-6 pr-0">
          {state === 'loading' ? (
            <div className="flex aspect-video items-center justify-center rounded-md border border-border bg-card">
              <LoaderCircle
                className="size-5 animate-spin text-muted-foreground"
                aria-hidden="true"
              />
              <span className="sr-only">Generating preview</span>
            </div>
          ) : null}
          {state === 'error' ? (
            <div className="flex aspect-video flex-col items-center justify-center gap-2 rounded-md border border-destructive/40 bg-card p-3 text-center">
              <p className="m-0 text-xs text-destructive">Preview failed</p>
              <Button type="button" size="sm" variant="outline" onClick={onRetry}>
                Retry
              </Button>
            </div>
          ) : null}
          {state === 'ready' && imageUrl ? (
            <img
              src={imageUrl}
              alt={`Slide ${slideNumber} preview`}
              className="aspect-video w-full rounded-md border border-border bg-card object-contain"
              data-testid="slide-preview-image"
              width={1920}
              height={1080}
            />
          ) : null}
          {state === 'closing' && imageUrl ? (
            <img
              src={imageUrl}
              alt=""
              aria-hidden="true"
              className="aspect-video w-full rounded-md border border-border bg-card object-contain opacity-80"
              data-testid="slide-preview-image"
              width={1920}
              height={1080}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}
