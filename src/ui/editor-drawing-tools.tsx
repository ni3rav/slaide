import type { ReactNode } from 'react'
import {
  ArrowUpRight,
  Circle,
  Diamond,
  Eraser,
  Hand,
  ImageIcon,
  Library,
  Minus,
  MousePointer2,
  Pencil,
  Redo2,
  Shapes,
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
  | 'autoshape'
  | 'text'
  | 'image'
  | 'eraser'

type ToolDefinition = {
  type: DrawingToolType
  label: string
  testId: string
  icon: ReactNode
  shortcut?: string
}

const NAV_TOOLS: ToolDefinition[] = [
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
]

const SHAPE_TOOLS: ToolDefinition[] = [
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
    icon: <ArrowUpRight />,
  },
  {
    type: 'line',
    label: 'Line',
    testId: 'editor-tool-line',
    icon: <Minus />,
  },
]

const MARKUP_TOOLS: ToolDefinition[] = [
  {
    type: 'freedraw',
    label: 'Draw',
    testId: 'editor-tool-freedraw',
    icon: <Pencil />,
  },
  {
    type: 'autoshape',
    label: 'Draw to shape',
    shortcut: 'Shift+X',
    testId: 'editor-tool-autoshape',
    icon: <Shapes />,
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
  libraryOpen?: boolean
  onSelectTool: (tool: DrawingToolType) => void
  onToggleLibrary: () => void
  onUndo: () => void
  onRedo: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onResetZoom: () => void
  zoomPercent: number
}

function ToolButton({
  tool,
  isActive,
  disabled,
  onSelectTool,
}: {
  tool: ToolDefinition
  isActive: boolean
  disabled: boolean
  onSelectTool: (tool: DrawingToolType) => void
}) {
  const title = tool.shortcut ? `${tool.label} (${tool.shortcut})` : tool.label
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      data-testid={tool.testId}
      aria-label={tool.label}
      title={title}
      aria-keyshortcuts={tool.shortcut}
      aria-pressed={isActive}
      disabled={disabled}
      className={cn(
        'size-7 text-muted-foreground hover:bg-background hover:text-foreground',
        isActive &&
          'bg-background text-foreground shadow-xs ring-1 ring-border',
      )}
      onClick={() => onSelectTool(tool.type)}
    >
      {tool.icon}
      <span className="sr-only">{title}</span>
    </Button>
  )
}

function ToolGroup({
  tools,
  activeTool,
  disabled,
  onSelectTool,
  label,
}: {
  tools: ToolDefinition[]
  activeTool: string
  disabled: boolean
  onSelectTool: (tool: DrawingToolType) => void
  label: string
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-0.5">
      {tools.map((tool) => (
        <ToolButton
          key={tool.type}
          tool={tool}
          isActive={activeTool === tool.type}
          disabled={disabled}
          onSelectTool={onSelectTool}
        />
      ))}
    </div>
  )
}

export function EditorDrawingTools({
  activeTool,
  disabled = false,
  libraryOpen = false,
  onSelectTool,
  onToggleLibrary,
  onUndo,
  onRedo,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  zoomPercent,
}: EditorDrawingToolsProps) {
  return (
    <div className="flex flex-col gap-2">
      <section aria-label="Drawing tools" className="flex flex-col gap-1.5">
        <p className="m-0 px-0.5 text-[10px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
          Tools
        </p>
        <div className="rounded-lg border border-border/80 bg-muted/40 p-1">
          <div className="flex flex-col gap-1">
            <ToolGroup
              tools={NAV_TOOLS}
              activeTool={activeTool}
              disabled={disabled}
              onSelectTool={onSelectTool}
              label="Navigation tools"
            />
            <div className="h-px bg-border/70" aria-hidden="true" />
            <ToolGroup
              tools={SHAPE_TOOLS}
              activeTool={activeTool}
              disabled={disabled}
              onSelectTool={onSelectTool}
              label="Shape tools"
            />
            <div className="h-px bg-border/70" aria-hidden="true" />
            <ToolGroup
              tools={MARKUP_TOOLS}
              activeTool={activeTool}
              disabled={disabled}
              onSelectTool={onSelectTool}
              label="Markup tools"
            />
            <div className="h-px bg-border/70" aria-hidden="true" />
            <div role="group" aria-label="Library tools" className="flex flex-wrap gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                data-testid="editor-tool-library"
                aria-label="Library"
                title="Library"
                aria-pressed={libraryOpen}
                disabled={disabled}
                className={cn(
                  // Excalidraw Sidebar outside-click ignores .sidebar-trigger so
                  // our toggle can close the panel instead of racing a reopen.
                  'sidebar-trigger size-7 text-muted-foreground hover:bg-background hover:text-foreground',
                  libraryOpen &&
                    'bg-background text-foreground shadow-xs ring-1 ring-border',
                )}
                onClick={onToggleLibrary}
              >
                <Library />
                <span className="sr-only">Library</span>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section
        aria-label="Canvas controls"
        className="flex items-center gap-1 rounded-lg border border-border/80 bg-muted/40 p-1"
      >
        <div role="group" aria-label="History" className="flex gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-7 text-muted-foreground hover:bg-background hover:text-foreground"
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
            className="size-7 text-muted-foreground hover:bg-background hover:text-foreground"
            aria-label="Redo"
            title="Redo"
            disabled={disabled}
            onClick={onRedo}
          >
            <Redo2 />
            <span className="sr-only">Redo</span>
          </Button>
        </div>

        <div className="mx-0.5 h-4 w-px shrink-0 bg-border" aria-hidden="true" />

        <div
          role="group"
          aria-label="Zoom"
          className="flex min-w-0 flex-1 items-center gap-0.5"
        >
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-7 text-muted-foreground hover:bg-background hover:text-foreground"
            aria-label="Zoom out"
            title="Zoom out"
            onClick={onZoomOut}
          >
            <ZoomOut />
            <span className="sr-only">Zoom out</span>
          </Button>
          <button
            type="button"
            className="m-0 min-w-0 flex-1 rounded-md px-1 py-1 text-center text-[11px] font-medium tabular-nums text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
            className="size-7 text-muted-foreground hover:bg-background hover:text-foreground"
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
