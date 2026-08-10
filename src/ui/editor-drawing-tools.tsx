import type { ReactNode } from 'react'
import {
  Circle,
  Diamond,
  Eraser,
  Hand,
  ImageIcon,
  Minus,
  MousePointer2,
  Pencil,
  Redo2,
  Square,
  Type,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type DrawingToolType =
  | 'selection'
  | 'hand'
  | 'rectangle'
  | 'diamond'
  | 'ellipse'
  | 'arrow'
  | 'line'
  | 'freedraw'
  | 'text'
  | 'image'
  | 'eraser'

type ToolDefinition = {
  type: DrawingToolType
  label: string
  testId: string
  icon: ReactNode
}

const TOOLS: ToolDefinition[] = [
  {
    type: 'selection',
    label: 'Selection',
    testId: 'editor-tool-selection',
    icon: <MousePointer2 />,
  },
  {
    type: 'hand',
    label: 'Hand',
    testId: 'editor-tool-hand',
    icon: <Hand />,
  },
  {
    type: 'rectangle',
    label: 'Rectangle',
    testId: 'editor-tool-rectangle',
    icon: <Square />,
  },
  {
    type: 'diamond',
    label: 'Diamond',
    testId: 'editor-tool-diamond',
    icon: <Diamond />,
  },
  {
    type: 'ellipse',
    label: 'Ellipse',
    testId: 'editor-tool-ellipse',
    icon: <Circle />,
  },
  {
    type: 'arrow',
    label: 'Arrow',
    testId: 'editor-tool-arrow',
    icon: (
      <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
        <path
          d="M5 19 19 5M19 5h-6M19 5v6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    type: 'line',
    label: 'Line',
    testId: 'editor-tool-line',
    icon: <Minus />,
  },
  {
    type: 'freedraw',
    label: 'Draw',
    testId: 'editor-tool-freedraw',
    icon: <Pencil />,
  },
  {
    type: 'text',
    label: 'Text',
    testId: 'editor-tool-text',
    icon: <Type />,
  },
  {
    type: 'image',
    label: 'Image',
    testId: 'editor-tool-image',
    icon: <ImageIcon />,
  },
  {
    type: 'eraser',
    label: 'Eraser',
    testId: 'editor-tool-eraser',
    icon: <Eraser />,
  },
]

type EditorDrawingToolsProps = {
  activeTool: string
  disabled?: boolean
  onSelectTool: (tool: DrawingToolType) => void
  onUndo: () => void
  onRedo: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onResetZoom: () => void
  zoomPercent: number
}

export function EditorDrawingTools({
  activeTool,
  disabled = false,
  onSelectTool,
  onUndo,
  onRedo,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  zoomPercent,
}: EditorDrawingToolsProps) {
  return (
    <div className="flex flex-col gap-2.5">
      <section aria-label="Drawing tools" className="flex flex-col gap-1">
        <p className="m-0 px-0.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
          Tools
        </p>
        <div className="grid grid-cols-4 gap-0.5">
          {TOOLS.map((tool) => {
            const isActive = activeTool === tool.type
            return (
              <Button
                key={tool.type}
                type="button"
                variant="ghost"
                size="icon-sm"
                data-testid={tool.testId}
                aria-label={tool.label}
                title={tool.label}
                aria-pressed={isActive}
                disabled={disabled}
                className={cn(
                  'size-8 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground',
                  isActive && 'bg-accent text-foreground ring-1 ring-border',
                )}
                onClick={() => onSelectTool(tool.type)}
              >
                {tool.icon}
                <span className="sr-only">{tool.label}</span>
              </Button>
            )
          })}
        </div>
      </section>

      <div className="h-px bg-border" aria-hidden="true" />

      <section aria-label="History" className="flex flex-col gap-1">
        <p className="m-0 px-0.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
          History
        </p>
        <div className="flex gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-8 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Undo"
            title="Undo"
            disabled={disabled}
            onClick={onUndo}
          >
            <Undo2 />
            <span className="sr-only">Undo</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-8 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Redo"
            title="Redo"
            disabled={disabled}
            onClick={onRedo}
          >
            <Redo2 />
            <span className="sr-only">Redo</span>
          </Button>
        </div>
      </section>

      <div className="h-px bg-border" aria-hidden="true" />

      <section aria-label="Zoom" className="flex flex-col gap-1">
        <p className="m-0 px-0.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
          Zoom
        </p>
        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-8 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Zoom out"
            title="Zoom out"
            onClick={onZoomOut}
          >
            <ZoomOut />
            <span className="sr-only">Zoom out</span>
          </Button>
          <button
            type="button"
            className="m-0 min-w-10 flex-1 rounded-md px-1 py-1.5 text-center text-[11px] tabular-nums text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Reset zoom"
            title="Reset zoom"
            onClick={onResetZoom}
          >
            {zoomPercent}%
          </button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-8 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Zoom in"
            title="Zoom in"
            onClick={onZoomIn}
          >
            <ZoomIn />
            <span className="sr-only">Zoom in</span>
          </Button>
        </div>
      </section>
    </div>
  )
}

export function clickExcalidrawControl(testId: string): void {
  const host = document.querySelector('[data-testid="excalidraw-host"]')
  const control = host?.querySelector<HTMLElement>(`[data-testid="${testId}"]`)
  control?.click()
}
