import { useEffect, useRef, useState, type MouseEvent, Fragment } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Excalidraw,
  MainMenu,
  convertToExcalidrawElements,
  newElementWith,
} from '@excalidraw/excalidraw'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import '@excalidraw/excalidraw/index.css'
import { GripVertical } from 'lucide-react'
import { useDeckRepository } from '../storage/deck-repository-context.tsx'
import type { Deck, Slide } from '../storage/deck-repository.ts'
import {
  closeDeckEditSessionNow,
  openDeckEditSession,
  waitForDeckEditLock,
} from '../storage/deck-edit-session.ts'
import { toPersistentScene } from '../scene/persistent-scene.ts'
import {
  createSceneAutosave,
  type SaveStatus,
} from '../scene/scene-autosave.ts'
import { createSlideConstraintController } from '../slide/slide-constraints.ts'
import {
  allElementsInsideSlide,
  constrainAllElements,
  constrainElementsAfterGesture,
  toElementsMap,
} from '../slide/slide-element-bounds.ts'
import { SLIDE_HEIGHT, SLIDE_WIDTH } from '../slide/slide-dimensions.ts'
import { planSlideInsertion } from '../slide/slide-reorder.ts'
import { exportDeckAsSlaideFile } from '../slaide-file/export-deck.ts'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { useTheme } from './ThemeProvider.tsx'
import { ThemeSelector } from './ThemeSelector.tsx'

type EditorState =
  | { status: 'loading' }
  | {
      status: 'ok'
      deck: Deck
      slides: Slide[]
      activeSlide: Slide
      editMode: 'editable' | 'readonly'
    }
  | { status: 'unavailable'; reason: 'missing' | 'corrupt' }

type SlaideTestApi = {
  addRectangle: () => void
  addOversizedRectangle: () => void
  moveRectangleOffSlide: () => void
  getElementCount: () => number
  getSceneElementCount: () => number
  getCamera: () => { scrollX: number; scrollY: number; zoom: number }
  getViewport: () => { width: number; height: number }
  setCamera: (camera: {
    scrollX?: number
    scrollY?: number
    zoom?: number
  }) => void
  getStoredElementsInsideSlide: () => boolean
}

declare global {
  interface Window {
    __slaideTest?: SlaideTestApi
  }
}

export function EditorPage() {
  const { deckId } = useParams<{ deckId: string }>()
  const repository = useDeckRepository()
  const { theme, setThemePreference } = useTheme()
  const navigate = useNavigate()
  const [state, setState] = useState<EditorState>({ status: 'loading' })
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [leaveWarning, setLeaveWarning] = useState(false)
  const [checkedSlideIds, setCheckedSlideIds] = useState<Set<string>>(() => new Set())
  const [exportError, setExportError] = useState(false)
  const [activeDragSlideId, setActiveDragSlideId] = useState<string | null>(null)
  const [insertionIndex, setInsertionIndex] = useState<number | null>(null)
  const insertionIndexRef = useRef<number | null>(null)
  const [presentStartDialogOpen, setPresentStartDialogOpen] = useState(false)
  const [presentError, setPresentError] = useState(false)
  const autosaveRef = useRef<ReturnType<typeof createSceneAutosave> | null>(null)
  const releaseLockRef = useRef<(() => void) | null>(null)
  const editSessionIdRef = useRef<number | null>(null)
  const takeoverCancelledRef = useRef(false)
  const excalidrawApiRef = useRef<ExcalidrawImperativeAPI | null>(null)
  const slideConstraintsRef = useRef<ReturnType<
    typeof createSlideConstraintController
  > | null>(null)
  const themeFromAppRef = useRef(theme)
  const suppressExcalidrawThemeSyncRef = useRef(false)

  useEffect(() => {
    themeFromAppRef.current = theme
    // Ignore Excalidraw theme echoes until it reports the app-driven theme.
    suppressExcalidrawThemeSyncRef.current = true
  }, [theme])

  useEffect(() => {
    if (!deckId) {
      setState({ status: 'unavailable', reason: 'missing' })
      return
    }

    let cancelled = false
    takeoverCancelledRef.current = false
    setState({ status: 'loading' })

    async function openDeck() {
      const [result, lock] = await Promise.all([
        repository.loadDeck(deckId!),
        openDeckEditSession(deckId!),
      ])
      if (cancelled) {
        if (lock.mode === 'editable') {
          closeDeckEditSessionNow(lock.sessionId)
        }
        return
      }

      if (result.status !== 'ok') {
        if (lock.mode === 'editable') closeDeckEditSessionNow(lock.sessionId)
        setState({ status: 'unavailable', reason: result.status })
        return
      }

      const activeSlide = result.slides[0]
      if (!activeSlide) {
        if (lock.mode === 'editable') closeDeckEditSessionNow(lock.sessionId)
        setState({ status: 'unavailable', reason: 'corrupt' })
        return
      }

      if (lock.mode === 'editable') {
        editSessionIdRef.current = lock.sessionId
        setState({
          status: 'ok',
          deck: result.deck,
          slides: result.slides,
          activeSlide,
          editMode: 'editable',
        })
        return
      }

      setState({
        status: 'ok',
        deck: result.deck,
        slides: result.slides,
        activeSlide,
        editMode: 'readonly',
      })

      void waitForDeckEditLock(deckId!).then(async (release) => {
        if (cancelled || takeoverCancelledRef.current) {
          release()
          return
        }

        const refreshed = await repository.loadDeck(deckId!)
        if (cancelled || takeoverCancelledRef.current) {
          release()
          return
        }
        if (refreshed.status !== 'ok') {
          release()
          setState({ status: 'unavailable', reason: refreshed.status })
          return
        }

        const refreshedSlide =
          refreshed.slides.find((slide) => slide.id === activeSlide.id) ??
          refreshed.slides[0]
        if (!refreshedSlide) {
          release()
          setState({ status: 'unavailable', reason: 'corrupt' })
          return
        }

        releaseLockRef.current = release
        setState({
          status: 'ok',
          deck: refreshed.deck,
          slides: refreshed.slides,
          activeSlide: refreshedSlide,
          editMode: 'editable',
        })
      })
    }

    void openDeck()

    return () => {
      cancelled = true
      takeoverCancelledRef.current = true
      if (releaseLockRef.current) {
        releaseLockRef.current()
      } else if (editSessionIdRef.current != null) {
        closeDeckEditSessionNow(editSessionIdRef.current)
      }
      releaseLockRef.current = null
      editSessionIdRef.current = null
    }
  }, [deckId, repository])

  useEffect(() => {
    if (state.status !== 'ok' || state.editMode !== 'editable') return

    const slideId = state.activeSlide.id
    const autosave = createSceneAutosave({
      save: async (scene) => {
        await repository.saveScene(slideId, scene)
      },
      onStatusChange: setSaveStatus,
    })
    autosaveRef.current = autosave

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        void autosave.flush().catch(() => undefined)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      autosaveRef.current = null
      slideConstraintsRef.current?.dispose()
      slideConstraintsRef.current = null
      excalidrawApiRef.current = null
      delete window.__slaideTest
      void autosave
        .flush()
        .catch(() => undefined)
        .finally(() => autosave.dispose())
    }
  }, [repository, state])

  async function flushActiveScene(): Promise<boolean> {
    try {
      await autosaveRef.current?.flush()
      return true
    } catch {
      return false
    }
  }

  async function reloadDeck(activeSlideId: string): Promise<void> {
    if (!deckId || state.status !== 'ok') return
    const result = await repository.loadDeck(deckId)
    if (result.status !== 'ok') {
      setState({ status: 'unavailable', reason: result.status })
      return
    }
    const activeSlide = result.slides.find((slide) => slide.id === activeSlideId)
    if (!activeSlide) {
      setState({ status: 'unavailable', reason: 'corrupt' })
      return
    }
    setState({
      status: 'ok',
      deck: result.deck,
      slides: result.slides,
      activeSlide,
      editMode: state.editMode,
    })
  }

  async function handleSelectSlide(slideId: string) {
    if (state.status !== 'ok') return
    if (slideId === state.activeSlide.id) return
    if (state.editMode === 'editable' && !(await flushActiveScene())) return
    await reloadDeck(slideId)
  }

  async function handleAddSlide() {
    if (state.status !== 'ok' || !deckId || state.editMode !== 'editable') return
    if (!(await flushActiveScene())) return

    const inserted = await repository.insertSlideAfter(deckId, state.activeSlide.id)
    setState({
      status: 'ok',
      deck: inserted.deck,
      slides: inserted.slides,
      activeSlide: inserted.slide,
      editMode: 'editable',
    })
  }

  function toggleSlideChecked(slideId: string) {
    setCheckedSlideIds((previous) => {
      const next = new Set(previous)
      if (next.has(slideId)) {
        next.delete(slideId)
      } else {
        next.add(slideId)
      }
      return next
    })
  }

  async function handleDeleteSlides() {
    if (state.status !== 'ok' || !deckId || state.editMode !== 'editable') return
    if (checkedSlideIds.size === 0) return
    if (!(await flushActiveScene())) return

    const deleted = await repository.deleteSlides(deckId, state.activeSlide.id, [
      ...checkedSlideIds,
    ])
    setCheckedSlideIds(new Set())
    setState({
      status: 'ok',
      deck: deleted.deck,
      slides: deleted.slides,
      activeSlide: deleted.activeSlide,
      editMode: 'editable',
    })
  }

  const slideSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleSlideDragStart(event: DragStartEvent) {
    setActiveDragSlideId(String(event.active.id))
  }

  function handleSlideDragOver(event: DragOverEvent) {
    if (state.status !== 'ok') return
    const nextInsertion =
      insertionIndexFromDragOver(event, state.deck.slideOrder) ?? null
    insertionIndexRef.current = nextInsertion
    setInsertionIndex(nextInsertion)
  }

  async function commitSlideReorder(slideId: string, insertionIndex: number) {
    if (state.status !== 'ok' || !deckId || state.editMode !== 'editable') return

    const plan = planSlideInsertion(
      state.deck.slideOrder,
      slideId,
      insertionIndex,
    )
    if (!plan.changed) return

    const reordered = await repository.reorderSlide(
      deckId,
      slideId,
      insertionIndex,
    )
    setState({
      status: 'ok',
      deck: reordered.deck,
      slides: reordered.slides,
      activeSlide:
        reordered.slides.find((slide) => slide.id === state.activeSlide.id) ??
        state.activeSlide,
      editMode: state.editMode,
    })
  }

  async function handleSlideDragEnd(event: DragEndEvent) {
    const trackedInsertion = insertionIndexRef.current
    setActiveDragSlideId(null)
    setInsertionIndex(null)
    insertionIndexRef.current = null
    if (state.status !== 'ok' || !deckId || state.editMode !== 'editable') return

    const slideId = String(event.active.id)
    const targetInsertion =
      insertionIndexFromDragOver(event, state.deck.slideOrder) ?? trackedInsertion
    if (targetInsertion == null) return

    await commitSlideReorder(slideId, targetInsertion)
  }

  function handleSlideDragCancel() {
    setActiveDragSlideId(null)
    setInsertionIndex(null)
    insertionIndexRef.current = null
  }

  async function handleHomeClick(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault()
    setLeaveWarning(false)
    try {
      await autosaveRef.current?.flush()
      navigate('/')
    } catch {
      setLeaveWarning(true)
    }
  }

  async function startPresentation(startIndex: number) {
    if (state.status !== 'ok' || !deckId) return
    setPresentError(false)
    setPresentStartDialogOpen(false)

    if (state.editMode === 'editable') {
      try {
        await autosaveRef.current?.flush()
      } catch {
        setPresentError(true)
        return
      }
    }

    navigate(`/decks/${deckId}/present?start=${startIndex}`)
  }

  function handlePresentClick() {
    if (state.status !== 'ok') return
    const activeSlideIndex = state.slides.findIndex(
      (slide) => slide.id === state.activeSlide.id,
    )
    if (activeSlideIndex <= 0) {
      void startPresentation(0)
      return
    }
    setPresentStartDialogOpen(true)
  }

  async function handleExport() {
    if (state.status !== 'ok' || !deckId) return
    setExportError(false)

    if (state.editMode === 'editable') {
      try {
        await autosaveRef.current?.flush()
      } catch {
        setExportError(true)
        return
      }
    }

    const loaded = await repository.loadDeck(deckId)
    if (loaded.status !== 'ok') {
      setState({ status: 'unavailable', reason: loaded.status })
      return
    }

    exportDeckAsSlaideFile(loaded.deck, loaded.slides)
  }

  if (state.status === 'loading') {
    return (
      <main className="p-6">
        <p className="text-muted-foreground">Loading deck…</p>
      </main>
    )
  }

  if (state.status === 'unavailable') {
    return (
      <main className="mx-auto max-w-lg space-y-4 p-6">
        <h1 className="text-2xl font-semibold">Deck unavailable</h1>
        <p className="text-muted-foreground">This deck could not be opened.</p>
        <Link
          to="/"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Return home
        </Link>
      </main>
    )
  }

  const isReadOnly = state.editMode === 'readonly'
  const activeSlideIndex = state.slides.findIndex(
    (slide) => slide.id === state.activeSlide.id,
  )
  const initialScene = state.activeSlide.scene

  return (
    <main className="m-0 flex h-svh max-w-none flex-row p-0">
      <aside
        className="flex w-36 shrink-0 flex-col gap-2 border-r border-border bg-muted/40 p-3"
        aria-label="Slides"
      >
        <Button
          type="button"
          className="w-full"
          size="sm"
          disabled={isReadOnly}
          onClick={() => void handleAddSlide()}
        >
          Add slide
        </Button>
        {checkedSlideIds.size > 0 && !isReadOnly ? (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="w-full"
            onClick={() => void handleDeleteSlides()}
          >
            Delete
          </Button>
        ) : null}
        <DndContext
          sensors={slideSensors}
          collisionDetection={slideListCollisionDetection}
          onDragStart={handleSlideDragStart}
          onDragOver={handleSlideDragOver}
          onDragEnd={(event) => void handleSlideDragEnd(event)}
          onDragCancel={handleSlideDragCancel}
        >
          <SortableContext
            items={state.slides.map((slide) => slide.id)}
            strategy={verticalListSortingStrategy}
          >
            <ol className="m-0 flex list-none flex-col gap-1 p-0">
              {state.slides.map((slide, index) => (
                <Fragment key={slide.id}>
                  <SlideInsertionIndicator
                    index={index}
                    active={insertionIndex === index}
                  />
                  <SortableSlideRow
                    slide={slide}
                    index={index}
                    isActive={slide.id === state.activeSlide.id}
                    isChecked={checkedSlideIds.has(slide.id)}
                    isReadOnly={isReadOnly}
                    isDragging={activeDragSlideId === slide.id}
                    slideCount={state.slides.length}
                    onSelect={() => void handleSelectSlide(slide.id)}
                    onToggleChecked={() => toggleSlideChecked(slide.id)}
                    onKeyboardReorder={(insertionIndex) =>
                      void commitSlideReorder(slide.id, insertionIndex)
                    }
                  />
                </Fragment>
              ))}
              <SlideInsertionIndicator
                index={state.slides.length}
                active={insertionIndex === state.slides.length}
              />
            </ol>
          </SortableContext>
          <DragOverlay dropAnimation={null}>
            {activeDragSlideId
              ? (() => {
                  const draggedSlide = state.slides.find(
                    (slide) => slide.id === activeDragSlideId,
                  )
                  const draggedIndex = state.slides.findIndex(
                    (slide) => slide.id === activeDragSlideId,
                  )
                  if (!draggedSlide) return null
                  return (
                    <SlideRowPreview
                      index={draggedIndex}
                      isActive={draggedSlide.id === state.activeSlide.id}
                      isChecked={checkedSlideIds.has(draggedSlide.id)}
                    />
                  )
                })()
              : null}
          </DragOverlay>
        </DndContext>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-border bg-muted/30 px-4 py-3">
          <h1 className="m-0 text-lg font-semibold">{state.deck.title}</h1>
          <p className="m-0 text-sm text-muted-foreground">
            Slide {activeSlideIndex + 1} of {state.slides.length}
          </p>
          {isReadOnly ? (
            <Alert
              className="basis-full"
              role="status"
              data-testid="readonly-notice"
            >
              <AlertTitle>Read-only</AlertTitle>
              <AlertDescription>
                This deck is open for editing in another tab or window. You can
                view slides here until that session ends.
              </AlertDescription>
            </Alert>
          ) : (
            <p
              role="status"
              aria-live="polite"
              className="m-0 text-sm"
              data-testid="save-status"
            >
              {formatSaveStatus(saveStatus)}
            </p>
          )}
          {exportError ? (
            <Alert className="basis-full" role="alert" data-testid="export-error">
              <AlertTitle>Export failed</AlertTitle>
              <AlertDescription>
                Your latest changes could not be saved. Fix the save error before
                exporting.
              </AlertDescription>
            </Alert>
          ) : null}
          {presentError ? (
            <Alert className="basis-full" role="alert" data-testid="present-error">
              <AlertTitle>Presentation failed</AlertTitle>
              <AlertDescription>
                Your latest changes could not be saved. Fix the save error before
                presenting.
              </AlertDescription>
            </Alert>
          ) : null}
          <div className="ml-auto flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handlePresentClick()}
            >
              Present
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleExport()}
            >
              Export deck
            </Button>
            <ThemeSelector />
            <Link
              to="/"
              className="font-medium text-primary underline-offset-4 hover:underline"
              onClick={(event) => void handleHomeClick(event)}
            >
              Home
            </Link>
          </div>
          <AlertDialog open={leaveWarning} onOpenChange={setLeaveWarning}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Save failed</AlertDialogTitle>
                <AlertDialogDescription>
                  Your latest changes could not be saved. Leave anyway?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Stay</AlertDialogCancel>
                <AlertDialogAction onClick={() => navigate('/')}>
                  Leave without saving
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <AlertDialog
            open={presentStartDialogOpen}
            onOpenChange={setPresentStartDialogOpen}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Start presentation</AlertDialogTitle>
                <AlertDialogDescription>
                  Choose where to begin presenting this deck.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    if (state.status !== 'ok') return
                    const activeSlideIndex = state.slides.findIndex(
                      (slide) => slide.id === state.activeSlide.id,
                    )
                    void startPresentation(activeSlideIndex)
                  }}
                >
                  From current slide
                </AlertDialogAction>
                <AlertDialogAction onClick={() => void startPresentation(0)}>
                  From beginning
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </header>
        <div
          className="editor-canvas relative min-h-0 flex-1 bg-muted/20 [&_.excalidraw]:h-full"
          data-testid="excalidraw-host"
        >          <Excalidraw
            key={`${state.activeSlide.id}:${state.editMode}`}
            theme={theme}
            initialData={{
              elements: initialScene.elements as never[],
              appState: {
                ...initialScene.appState,
                showWelcomeScreen: false,
              },
              files: initialScene.files as never,
            }}
            viewModeEnabled={isReadOnly}
            UIOptions={{
              canvasActions: {
                loadScene: false,
                saveToActiveFile: false,
                export: false,
                saveAsImage: false,
                clearCanvas: !isReadOnly,
                changeViewBackgroundColor: !isReadOnly,
                toggleTheme: true,
              },
              tools: {
                image: !isReadOnly,
              },
            }}
            aiEnabled={false}
            validateEmbeddable={false}
            onLinkOpen={(element, event) => {
              event.preventDefault()
              if (element.link) {
                window.open(element.link, '_blank', 'noopener,noreferrer')
              }
            }}
            excalidrawAPI={(api) => {
              if (isReadOnly) {
                slideConstraintsRef.current?.dispose()
                slideConstraintsRef.current = null
                delete window.__slaideTest
                return
              }
              excalidrawApiRef.current = api
              slideConstraintsRef.current?.dispose()
              slideConstraintsRef.current = createSlideConstraintController(
                api,
                () => {
                  const { width, height } = api.getAppState()
                  if (width <= 0 || height <= 0) {
                    return null
                  }
                  return { width, height }
                },
              )
              requestAnimationFrame(() => {
                slideConstraintsRef.current?.fitSlideToViewport()
              })
              window.__slaideTest = {
                addRectangle() {
                  const created = convertToExcalidrawElements([
                    {
                      type: 'rectangle',
                      x: 120,
                      y: 140,
                      width: 220,
                      height: 120,
                    },
                  ])
                  api.updateScene({
                    elements: [...api.getSceneElements(), ...created],
                  })
                },
                moveRectangleOffSlide() {
                  const elements = api.getSceneElements()
                  const rectangle = elements.find(
                    (element) => element.type === 'rectangle',
                  )
                  if (!rectangle) {
                    throw new Error('rectangle missing')
                  }
                  const moved = newElementWith(rectangle, { x: 1800, y: 980 })
                  api.updateScene({
                    elements: elements.map((element) =>
                      element.id === moved.id ? moved : element,
                    ),
                  })
                  slideConstraintsRef.current?.enforceElementsForTest()
                },
                addOversizedRectangle() {
                  const created = convertToExcalidrawElements([
                    {
                      type: 'rectangle',
                      x: 0,
                      y: 0,
                      width: SLIDE_WIDTH * 2,
                      height: SLIDE_HEIGHT * 2,
                    },
                  ])
                  api.updateScene({
                    elements: constrainAllElements([
                      ...api.getSceneElements(),
                      ...created,
                    ]),
                  })
                },
                getElementCount() {
                  return api.getSceneElements().length
                },
                getSceneElementCount() {
                  return api.getSceneElements().length
                },
                getCamera() {
                  const { scrollX, scrollY, zoom } = api.getAppState()
                  return { scrollX, scrollY, zoom: zoom.value }
                },
                getViewport() {
                  const { width, height } = api.getAppState()
                  return { width, height }
                },
                setCamera(camera) {
                  const current = api.getAppState()
                  api.updateScene({
                    appState: {
                      scrollX: camera.scrollX ?? current.scrollX,
                      scrollY: camera.scrollY ?? current.scrollY,
                      zoom: {
                        value: (camera.zoom ?? current.zoom.value) as never,
                      },
                    },
                  })
                  slideConstraintsRef.current?.correctCamera()
                },
                getStoredElementsInsideSlide() {
                  return allElementsInsideSlide(api.getSceneElements())
                },
              }
            }}
            onDuplicate={(nextElements, previousElements) =>
              constrainElementsAfterGesture(
                nextElements,
                toElementsMap(previousElements),
              )
            }
            onChange={(elements, appState, files) => {
              if (isReadOnly) return
              const nextTheme = appState.theme
              if (nextTheme === 'light' || nextTheme === 'dark') {
                if (nextTheme === themeFromAppRef.current) {
                  suppressExcalidrawThemeSyncRef.current = false
                } else if (!suppressExcalidrawThemeSyncRef.current) {
                  themeFromAppRef.current = nextTheme
                  void setThemePreference(nextTheme)
                }
              }
              if (slideConstraintsRef.current?.isGestureActive()) {
                return
              }
              if (!allElementsInsideSlide(elements as never[])) {
                return
              }
              const scene = toPersistentScene(
                elements,
                appState as unknown as Record<string, unknown>,
                files as unknown as Record<string, unknown>,
              )
              autosaveRef.current?.schedule(scene)
            }}
          >
            <MainMenu>
              {!isReadOnly ? <MainMenu.DefaultItems.ClearCanvas /> : null}
              <MainMenu.DefaultItems.ToggleTheme />
              {!isReadOnly ? (
                <MainMenu.DefaultItems.ChangeCanvasBackground />
              ) : null}
            </MainMenu>
          </Excalidraw>
        </div>
      </div>
    </main>
  )
}

function formatSaveStatus(status: SaveStatus): string {
  switch (status) {
    case 'saving':
      return 'Saving…'
    case 'failed':
      return 'Save failed'
    case 'saved':
      return 'Saved'
  }
}

type SortableSlideRowProps = {
  slide: Slide
  index: number
  isActive: boolean
  isChecked: boolean
  isReadOnly: boolean
  isDragging: boolean
  slideCount: number
  onSelect: () => void
  onToggleChecked: () => void
  onKeyboardReorder: (insertionIndex: number) => void
}

function SortableSlideRow({
  slide,
  index,
  isActive,
  isChecked,
  isReadOnly,
  isDragging,
  slideCount,
  onSelect,
  onToggleChecked,
  onKeyboardReorder,
}: SortableSlideRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
  } = useSortable({
    id: slide.id,
    disabled: isReadOnly,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  }

  return (
    <li ref={setNodeRef} style={style} className="flex items-center gap-1">
      <input
        type="checkbox"
        className="size-4 shrink-0 accent-primary"
        checked={isChecked}
        disabled={isReadOnly}
        aria-label={`Select slide ${index + 1}`}
        onChange={onToggleChecked}
        onClick={(event) => event.stopPropagation()}
      />
      <Button
        type="button"
        variant={isActive ? 'secondary' : 'ghost'}
        size="sm"
        className="min-w-0 flex-1"
        aria-current={isActive ? 'true' : undefined}
        onClick={onSelect}
      >
        {index + 1}
      </Button>
      <button
        type="button"
        ref={setActivatorNodeRef}
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40"
        aria-label={`Reorder slide ${index + 1}`}
        disabled={isReadOnly}
        onClick={(event) => event.preventDefault()}
        {...attributes}
        {...listeners}
        onKeyDown={(event) => {
          if (listeners?.onKeyDown) {
            listeners.onKeyDown(event)
          }
          if (event.defaultPrevented || isDragging) return

          if (event.key === 'ArrowDown') {
            event.preventDefault()
            onKeyboardReorder(Math.min(index + 2, slideCount))
          } else if (event.key === 'ArrowUp' && index > 0) {
            event.preventDefault()
            onKeyboardReorder(index)
          }
        }}
      >
        <GripVertical className="size-4" aria-hidden="true" />
      </button>
    </li>
  )
}

function SlideRowPreview({
  index,
  isActive,
  isChecked,
}: {
  index: number
  isActive: boolean
  isChecked: boolean
}) {
  return (
    <div className="flex items-center gap-1 rounded-md border border-border bg-background px-1 py-0.5 shadow-sm">
      <input
        type="checkbox"
        className="size-4 shrink-0 accent-primary"
        checked={isChecked}
        readOnly
        aria-hidden="true"
        tabIndex={-1}
      />
      <span
        className={`inline-flex h-8 min-w-8 flex-1 items-center justify-center rounded-md text-sm ${
          isActive ? 'bg-secondary' : ''
        }`}
      >
        {index + 1}
      </span>
      <span className="inline-flex size-7 items-center justify-center text-muted-foreground">
        <GripVertical className="size-4" aria-hidden="true" />
      </span>
    </div>
  )
}

function SlideInsertionIndicator({
  index,
  active,
}: {
  index: number
  active: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `insertion-${index}`,
    data: { type: 'insertion', index },
  })

  const showIndicator = active || isOver

  return (
    <div
      ref={setNodeRef}
      data-testid={`slide-insertion-${index}`}
      className="relative -my-1 h-3"
      aria-hidden="true"
    >
      <div
        className={`absolute inset-x-1 top-1/2 -translate-y-1/2 rounded-full transition-all ${
          showIndicator ? 'h-0.5 bg-primary' : 'h-px bg-transparent'
        }`}
      />
    </div>
  )
}

const slideListCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args)
  const insertionCollision = pointerCollisions.find((collision) =>
    String(collision.id).startsWith('insertion-'),
  )
  if (insertionCollision) {
    return [insertionCollision]
  }
  return closestCenter(args)
}

function insertionIndexFromDragOver(
  event: DragOverEvent | DragEndEvent,
  slideOrder: readonly string[],
): number | null {
  const { active, over } = event
  if (!over) return null

  if (typeof over.id === 'string' && over.id.startsWith('insertion-')) {
    return Number.parseInt(over.id.slice('insertion-'.length), 10)
  }

  const activeIndex = slideOrder.indexOf(String(active.id))
  const overIndex = slideOrder.indexOf(String(over.id))
  if (overIndex === -1 || activeIndex === -1) return null

  const overRect = over.rect
  const activeTranslated = active.rect.current.translated
  if (!activeTranslated) {
    return activeIndex < overIndex ? overIndex + 1 : overIndex
  }

  const overMiddle = overRect.top + overRect.height / 2
  return activeTranslated.top > overMiddle ? overIndex + 1 : overIndex
}
