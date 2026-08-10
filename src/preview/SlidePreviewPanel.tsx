import { LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export type SlidePreviewPanelState =
  | 'loading'
  | 'ready'
  | 'error'

type SlidePreviewPanelProps = {
  slideNumber: number
  state: SlidePreviewPanelState
  imageUrl: string | null
  onRetry: () => void
}

export function SlidePreviewPanel({
  slideNumber,
  state,
  imageUrl,
  onRetry,
}: SlidePreviewPanelProps) {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-md bg-card"
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
      {state === 'ready' && imageUrl ? (
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
