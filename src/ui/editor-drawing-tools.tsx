import type { ReactNode } from 'react'
import {
  ArrowUpRight,
  BringToFront,
  ChevronsDown,
  ChevronsUp,
  Circle,
  Diamond,
  Eraser,
  Grid2x2,
  Group,
  Hand,
  ImageIcon,
  LassoSelect,
  Library,
  Minus,
  MousePointer2,
  PaintBucket,
  Pencil,
  Redo2,
  SendToBack,
  Shapes,
  Square,
  Type,
  Undo2,
  Ungroup,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type DrawingToolType =
  | 'selection'
  | 'lasso'
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
  | 'bucketfill'

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
    type: 'lasso',
    label: 'Lasso select',
    testId: 'editor-tool-lasso',
    icon: <LassoSelect />,
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
  {
    type: 'bucketfill',
    label: 'Bucket fill',
    shortcut: 'B',
    testId: 'editor-tool-bucketfill',
    icon: <PaintBucket />,
  },
]

type ActionButtonProps = {
  label: string
  testId: string
  icon: ReactNode
  shortcut?: string
  disabled?: boolean
  pressed?: boolean
  className?: string
  onClick: () => void
}

type EditorDrawingToolsProps = {
  activeTool: string
  disabled?: boolean
  libraryOpen?: boolean
  gridEnabled?: boolean
  selectionCount?: number
  canUngroup?: boolean
  onSelectTool: (tool: DrawingToolType) => void
  onToggleLibrary: () => void
  onGroup: () => void
  onUngroup: () => void
  onBringToFront: () => void
  onBringForward: () => void
  onSendBackward: () => void
  onSendToBack: () => void
  onToggleGrid: () => void
  onUndo: () => void
  onRedo: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onResetZoom: () => void
  zoomPercent: number
}

function ActionButton({
  label,
  testId,
  icon,
  shortcut,
  disabled = false,
  pressed,
  className,
  onClick,
}: ActionButtonProps) {
  const title = shortcut ? `${label} (${shortcut})` : label
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      data-testid={testId}
      aria-label={label}
      title={title}
      aria-keyshortcuts={shortcut}
      aria-pressed={pressed}
      disabled={disabled}
      className={cn(
        'size-7 text-muted-foreground hover:bg-background hover:text-foreground',
        pressed &&
          'bg-background text-foreground shadow-xs ring-1 ring-border',
        className,
      )}
      onClick={onClick}
    >
      {icon}
      <span className="sr-only">{title}</span>
    </Button>
  )
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
  return (
    <ActionButton
      label={tool.label}
      testId={tool.testId}
      icon={tool.icon}
      shortcut={tool.shortcut}
      disabled={disabled}
      pressed={isActive}
      onClick={() => onSelectTool(tool.type)}
    />
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
  gridEnabled = false,
  selectionCount = 0,
  canUngroup = false,
  onSelectTool,
  onToggleLibrary,
  onGroup,
  onUngroup,
  onBringToFront,
  onBringForward,
  onSendBackward,
  onSendToBack,
  onToggleGrid,
  onUndo,
  onRedo,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  zoomPercent,
}: EditorDrawingToolsProps) {
  const hasSelection = selectionCount > 0
  const canGroup = selectionCount >= 2

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
              <ActionButton
                label="Library"
                testId="editor-tool-library"
                icon={<Library />}
                disabled={disabled}
                pressed={libraryOpen}
                // Excalidraw Sidebar outside-click ignores .sidebar-trigger so
                // our toggle can close the panel instead of racing a reopen.
                className="sidebar-trigger"
                onClick={onToggleLibrary}
              />
            </div>
          </div>
        </div>
      </section>

      <section aria-label="Arrange" className="flex flex-col gap-1.5">
        <p className="m-0 px-0.5 text-[10px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
          Arrange
        </p>
        <div className="rounded-lg border border-border/80 bg-muted/40 p-1">
          <div className="flex flex-col gap-1">
            <div role="group" aria-label="Group" className="flex flex-wrap gap-0.5">
              <ActionButton
                label="Group selection"
                shortcut="Ctrl+G"
                testId="editor-action-group"
                icon={<Group />}
                disabled={disabled || !canGroup}
                onClick={onGroup}
              />
              <ActionButton
                label="Ungroup selection"
                shortcut="Ctrl+Shift+G"
                testId="editor-action-ungroup"
                icon={<Ungroup />}
                disabled={disabled || !canUngroup}
                onClick={onUngroup}
              />
            </div>
            <div className="h-px bg-border/70" aria-hidden="true" />
            <div role="group" aria-label="Layers" className="flex flex-wrap gap-0.5">
              <ActionButton
                label="Send to back"
                shortcut="Ctrl+Shift+["
                testId="editor-action-send-to-back"
                icon={<SendToBack />}
                disabled={disabled || !hasSelection}
                onClick={onSendToBack}
              />
              <ActionButton
                label="Send backward"
                shortcut="Ctrl+["
                testId="editor-action-send-backward"
                icon={<ChevronsDown />}
                disabled={disabled || !hasSelection}
                onClick={onSendBackward}
              />
              <ActionButton
                label="Bring forward"
                shortcut="Ctrl+]"
                testId="editor-action-bring-forward"
                icon={<ChevronsUp />}
                disabled={disabled || !hasSelection}
                onClick={onBringForward}
              />
              <ActionButton
                label="Bring to front"
                shortcut="Ctrl+Shift+]"
                testId="editor-action-bring-to-front"
                icon={<BringToFront />}
                disabled={disabled || !hasSelection}
                onClick={onBringToFront}
              />
            </div>
          </div>
        </div>
      </section>

      <section
        aria-label="Canvas controls"
        className="flex flex-col gap-1 rounded-lg border border-border/80 bg-muted/40 p-1"
      >
        <div className="flex items-center gap-1">
          <div role="group" aria-label="History" className="flex gap-0.5">
            <ActionButton
              label="Undo"
              testId="editor-action-undo"
              icon={<Undo2 />}
              disabled={disabled}
              onClick={onUndo}
            />
            <ActionButton
              label="Redo"
              testId="editor-action-redo"
              icon={<Redo2 />}
              disabled={disabled}
              onClick={onRedo}
            />
          </div>

          <div className="mx-0.5 h-4 w-px shrink-0 bg-border" aria-hidden="true" />

          <div
            role="group"
            aria-label="Zoom"
            className="flex min-w-0 flex-1 items-center gap-0.5"
          >
            <ActionButton
              label="Zoom out"
              testId="editor-action-zoom-out"
              icon={<ZoomOut />}
              onClick={onZoomOut}
            />
            <button
              type="button"
              className="m-0 min-w-0 flex-1 rounded-md px-1 py-1 text-center text-[11px] font-medium tabular-nums text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Reset zoom"
              title="Reset zoom"
              data-testid="editor-action-reset-zoom"
              onClick={onResetZoom}
            >
              {zoomPercent}%
            </button>
            <ActionButton
              label="Zoom in"
              testId="editor-action-zoom-in"
              icon={<ZoomIn />}
              onClick={onZoomIn}
            />
          </div>
        </div>

        <div className="h-px bg-border/70" aria-hidden="true" />

        <div role="group" aria-label="View" className="flex flex-wrap gap-0.5">
          <ActionButton
            label="Toggle grid"
            shortcut="Ctrl+'"
            testId="editor-action-toggle-grid"
            icon={<Grid2x2 />}
            disabled={disabled}
            pressed={gridEnabled}
            onClick={onToggleGrid}
          />
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

/** Click an Excalidraw chrome control matched by accessible name / title. */
export function clickExcalidrawLabeledControl(label: string): boolean {
  const host = document.querySelector('[data-testid="excalidraw-host"]')
  if (!host) return false
  const controls = host.querySelectorAll<HTMLElement>('button, [role="button"]')
  for (const control of controls) {
    if (!isVisibleControl(control)) continue
    const ariaLabel = control.getAttribute('aria-label')
    const title = control.getAttribute('title') ?? ''
    if (
      ariaLabel === label ||
      title === label ||
      title.startsWith(`${label} —`) ||
      title.startsWith(`${label} -`) ||
      title.startsWith(`${label} `)
    ) {
      control.click()
      return true
    }
  }
  return false
}

function isVisibleControl(control: HTMLElement): boolean {
  if (control.hidden || control.getAttribute('aria-hidden') === 'true') {
    return false
  }
  // Visually-hidden Excalidraw footer controls (undo/redo) stay actionable.
  if (control.closest('.layer-ui__wrapper__footer-left, .layer-ui__wrapper__footer-right')) {
    return true
  }
  const style = window.getComputedStyle(control)
  return style.display !== 'none' && style.visibility !== 'hidden'
}

type ArrangeShortcut = {
  key: string
  code: string
  shiftKey?: boolean
  altKey?: boolean
}

const ARRANGE_SHORTCUTS: Record<string, ArrangeShortcut> = {
  'Group selection': { key: 'g', code: 'KeyG' },
  'Ungroup selection': { key: 'G', code: 'KeyG', shiftKey: true },
  'Send backward': { key: '[', code: 'BracketLeft' },
  'Bring forward': { key: ']', code: 'BracketRight' },
  'Send to back': { key: '[', code: 'BracketLeft', shiftKey: true },
  'Bring to front': { key: ']', code: 'BracketRight', shiftKey: true },
}

function isApplePlatform(): boolean {
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform)
}

/** Run a labeled arrange action via Excalidraw UI, falling back to shortcuts. */
export function runExcalidrawArrangeAction(label: string): void {
  if (clickExcalidrawLabeledControl(label)) return
  const shortcut = ARRANGE_SHORTCUTS[label]
  if (!shortcut) return
  const apple = isApplePlatform()
  const useAltForEnds =
    apple && (label === 'Send to back' || label === 'Bring to front')
  const canvas = document.querySelector<HTMLElement>(
    '.excalidraw .excalidraw__canvas.interactive',
  )
  canvas?.focus()
  const eventInit: KeyboardEventInit = {
    key: shortcut.key,
    code: shortcut.code,
    ctrlKey: !apple,
    metaKey: apple,
    shiftKey: useAltForEnds ? false : Boolean(shortcut.shiftKey),
    altKey: useAltForEnds ? true : Boolean(shortcut.altKey),
    bubbles: true,
    cancelable: true,
  }
  const event = new KeyboardEvent('keydown', eventInit)
  const targets: EventTarget[] = []
  if (canvas) targets.push(canvas)
  const root = document.querySelector('.excalidraw')
  if (root) targets.push(root)
  targets.push(document)
  targets.push(window)
  for (const target of targets) {
    target.dispatchEvent(new KeyboardEvent('keydown', eventInit))
  }
  void event
}
