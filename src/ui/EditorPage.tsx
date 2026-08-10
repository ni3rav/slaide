import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  Fragment,
} from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  Excalidraw,
  MainMenu,
  convertToExcalidrawElements,
  newElementWith,
} from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import "@excalidraw/excalidraw/index.css";
import {
  ArrowLeftRight,
  Copy,
  Download,
  Eye,
  FileJson,
  FileText,
  GripVertical,
  Home,
  LoaderCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Presentation,
  Trash2,
} from "lucide-react";
import { SlidePreviewPanel } from "../preview/SlidePreviewPanel.tsx";
import { useSlidePreview } from "../preview/use-slide-preview.ts";
import type { SlidePreviewSession } from "../preview/use-slide-preview.ts";
import type { Scene } from "../storage/deck-repository.ts";
import { useDeckRepository } from "../storage/deck-repository-context.tsx";
import type { Deck, Slide } from "../storage/deck-repository.ts";
import {
  closeDeckEditSessionNow,
  openDeckEditSession,
  waitForDeckEditLock,
} from "../storage/deck-edit-session.ts";
import { toPersistentScene } from "../scene/persistent-scene.ts";
import {
  createSceneAutosave,
  type SaveStatus,
} from "../scene/scene-autosave.ts";
import { createSlideConstraintController } from "../slide/slide-constraints.ts";
import {
  allElementsInsideSlide,
  constrainAllElements,
  constrainElementsAfterGesture,
  toElementsMap,
} from "../slide/slide-element-bounds.ts";
import { SLIDE_HEIGHT, SLIDE_WIDTH } from "../slide/slide-dimensions.ts";
import { clampCamera } from "../slide/slide-camera.ts";
import { planSlideInsertion } from "../slide/slide-reorder.ts";
import { exportDeckAsSlaideFile } from "../slaide-file/export-deck.ts";
import {
  exitPresentationFullscreen,
  requestPresentationFullscreen,
} from "../presentation/request-fullscreen.ts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "./ThemeProvider.tsx";
import { ThemeSelector } from "./ThemeSelector.tsx";
import { ExportThemeDialog } from "./ExportThemeDialog.tsx";
import type { DeckTheme } from "../storage/deck-repository.ts";
import {
  EditorDrawingTools,
  clickExcalidrawControl,
  type DrawingToolType,
} from "./editor-drawing-tools.tsx";

type EditorState =
  | { status: "loading" }
  | {
      status: "ok";
      deck: Deck;
      slides: Slide[];
      activeSlide: Slide;
      editMode: "editable" | "readonly";
    }
  | { status: "unavailable"; reason: "missing" | "corrupt" };

type SlaideTestApi = {
  addRectangle: () => void;
  addOversizedRectangle: () => void;
  moveRectangleOffSlide: () => void;
  getElementCount: () => number;
  getSceneElementCount: () => number;
  getCamera: () => { scrollX: number; scrollY: number; zoom: number };
  getViewport: () => { width: number; height: number };
  getElementGeometry: () => Array<{
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  setCamera: (camera: {
    scrollX?: number;
    scrollY?: number;
    zoom?: number;
  }) => void;
  getStoredElementsInsideSlide: () => boolean;
};

declare global {
  interface Window {
    __slaideTest?: SlaideTestApi;
  }
}

export function EditorPage() {
  const { deckId } = useParams<{ deckId: string }>();
  const repository = useDeckRepository();
  const { theme, setThemePreference } = useTheme();
  const navigate = useNavigate();
  const [state, setState] = useState<EditorState>({ status: "loading" });
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [leaveWarning, setLeaveWarning] = useState(false);
  const [checkedSlideIds, setCheckedSlideIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [exportFailureStage, setExportFailureStage] = useState<
    "export" | "save" | null
  >(null);
  const [exporting, setExporting] = useState(false);
  const [activeDragSlideId, setActiveDragSlideId] = useState<string | null>(
    null,
  );
  const [insertionIndex, setInsertionIndex] = useState<number | null>(null);
  const [isSlideReordering, setIsSlideReordering] = useState(false);
  const insertionIndexRef = useRef<number | null>(null);
  const slideReorderInFlightRef = useRef(false);
  const [presentStartDialogOpen, setPresentStartDialogOpen] = useState(false);
  const [presentError, setPresentError] = useState(false);
  const [pendingExportFormat, setPendingExportFormat] = useState<
    "pdf" | "slaide" | null
  >(null);
  const [activeTool, setActiveTool] = useState<string>("selection");
  const [zoomPercent, setZoomPercent] = useState(100);
  const autosaveRef = useRef<ReturnType<typeof createSceneAutosave> | null>(
    null,
  );
  const releaseLockRef = useRef<(() => void) | null>(null);
  const editSessionIdRef = useRef<number | null>(null);
  const takeoverCancelledRef = useRef(false);
  const excalidrawApiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const editorHostRef = useRef<HTMLDivElement | null>(null);
  const slideConstraintsRef = useRef<ReturnType<
    typeof createSlideConstraintController
  > | null>(null);
  const themeFromAppRef = useRef(theme);
  const suppressExcalidrawThemeSyncRef = useRef(false);

  const resolveSceneForPreview = useCallback(
    async (slide: Slide, isActive: boolean): Promise<Scene> => {
      if (isActive && state.status === "ok" && state.editMode === "editable") {
        await autosaveRef.current?.flush();
      }

      if (!deckId) {
        throw new Error("Deck is unavailable");
      }

      const latest = await repository.loadDeck(deckId);
      if (latest.status !== "ok") {
        throw new Error("Deck is unavailable");
      }
      const stored = latest.slides.find((entry) => entry.id === slide.id);
      if (!stored) {
        throw new Error("Slide is unavailable");
      }
      return stored.scene;
    },
    [deckId, repository, state],
  );

  const {
    session: previewSession,
    openPreview,
    clearPreview,
    retryPreview,
  } = useSlidePreview({ resolveScene: resolveSceneForPreview, theme });

  useEffect(() => {
    if (state.status !== "ok" || !editorHostRef.current) return;

    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        slideConstraintsRef.current?.fitSlideToViewport();
      });
    });
    observer.observe(editorHostRef.current);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [state.status]);

  useEffect(() => {
    themeFromAppRef.current = theme;
    // Ignore Excalidraw theme echoes until it reports the app-driven theme.
    suppressExcalidrawThemeSyncRef.current = true;
  }, [theme]);

  useEffect(() => {
    if (state.status !== "ok") return;
    if (!previewSession) return;

    const sessionSlideId = previewSession.slideId;
    const activeSlideId = state.activeSlide.id;
    const slides = state.slides;

    function handlePreviewEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (document.querySelector('[role="dialog"],[role="alertdialog"]')) return;
      const slide = slides.find((entry) => entry.id === sessionSlideId);
      if (!slide) return;
      event.preventDefault();
      event.stopPropagation();
      openPreview(slide, slide.id === activeSlideId);
    }

    window.addEventListener("keydown", handlePreviewEscape, true);
    return () => window.removeEventListener("keydown", handlePreviewEscape, true);
  }, [openPreview, previewSession, state]);

  useEffect(() => {
    setCheckedSlideIds(new Set());
    clearPreview();
  }, [clearPreview, deckId]);

  useEffect(() => {
    if (!deckId) {
      setState({ status: "unavailable", reason: "missing" });
      return;
    }

    let cancelled = false;
    takeoverCancelledRef.current = false;
    setState({ status: "loading" });

    async function openDeck() {
      const [result, lock] = await Promise.all([
        repository.loadDeck(deckId!),
        openDeckEditSession(deckId!),
      ]);
      if (cancelled) {
        if (lock.mode === "editable") {
          closeDeckEditSessionNow(lock.sessionId);
        }
        return;
      }

      if (result.status !== "ok") {
        if (lock.mode === "editable") closeDeckEditSessionNow(lock.sessionId);
        setState({ status: "unavailable", reason: result.status });
        return;
      }

      const activeSlide = result.slides[0];
      if (!activeSlide) {
        if (lock.mode === "editable") closeDeckEditSessionNow(lock.sessionId);
        setState({ status: "unavailable", reason: "corrupt" });
        return;
      }

      if (lock.mode === "editable") {
        editSessionIdRef.current = lock.sessionId;
        setState({
          status: "ok",
          deck: result.deck,
          slides: result.slides,
          activeSlide,
          editMode: "editable",
        });
        return;
      }

      setState({
        status: "ok",
        deck: result.deck,
        slides: result.slides,
        activeSlide,
        editMode: "readonly",
      });

      void waitForDeckEditLock(deckId!).then(async (release) => {
        if (cancelled || takeoverCancelledRef.current) {
          release();
          return;
        }

        const refreshed = await repository.loadDeck(deckId!);
        if (cancelled || takeoverCancelledRef.current) {
          release();
          return;
        }
        if (refreshed.status !== "ok") {
          release();
          setState({ status: "unavailable", reason: refreshed.status });
          return;
        }

        const refreshedSlide =
          refreshed.slides.find((slide) => slide.id === activeSlide.id) ??
          refreshed.slides[0];
        if (!refreshedSlide) {
          release();
          setState({ status: "unavailable", reason: "corrupt" });
          return;
        }

        releaseLockRef.current = release;
        setState({
          status: "ok",
          deck: refreshed.deck,
          slides: refreshed.slides,
          activeSlide: refreshedSlide,
          editMode: "editable",
        });
      });
    }

    void openDeck();

    return () => {
      cancelled = true;
      takeoverCancelledRef.current = true;
      if (releaseLockRef.current) {
        releaseLockRef.current();
      } else if (editSessionIdRef.current != null) {
        closeDeckEditSessionNow(editSessionIdRef.current);
      }
      releaseLockRef.current = null;
      editSessionIdRef.current = null;
    };
  }, [deckId, repository]);

  useEffect(() => {
    if (state.status !== "ok" || state.editMode !== "editable") return;

    const slideId = state.activeSlide.id;
    const initialScene = state.activeSlide.scene;
    const autosave = createSceneAutosave({
      save: async (scene) => {
        await repository.saveScene(slideId, scene);
      },
      onStatusChange: setSaveStatus,
      initialScene,
    });
    autosaveRef.current = autosave;
    setSaveStatus("saved");

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        void autosave.flush().catch(() => undefined);
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      autosaveRef.current = null;
      slideConstraintsRef.current?.dispose();
      slideConstraintsRef.current = null;
      excalidrawApiRef.current = null;
      delete window.__slaideTest;
      void autosave
        .flush()
        .catch(() => undefined)
        .finally(() => autosave.dispose());
    };
  }, [
    repository,
    state.status,
    state.status === "ok" ? state.activeSlide.id : null,
    state.status === "ok" ? state.editMode : null,
  ]);

  async function flushActiveScene(): Promise<boolean> {
    try {
      await autosaveRef.current?.flush();
      return true;
    } catch {
      return false;
    }
  }

  async function reloadDeck(activeSlideId: string): Promise<void> {
    if (!deckId || state.status !== "ok") return;
    const result = await repository.loadDeck(deckId);
    if (result.status !== "ok") {
      setState({ status: "unavailable", reason: result.status });
      return;
    }
    const activeSlide = result.slides.find(
      (slide) => slide.id === activeSlideId,
    );
    if (!activeSlide) {
      setState({ status: "unavailable", reason: "corrupt" });
      return;
    }
    setState({
      status: "ok",
      deck: result.deck,
      slides: result.slides,
      activeSlide,
      editMode: state.editMode,
    });
  }

  async function handleSelectSlide(slideId: string) {
    if (state.status !== "ok") return;
    if (slideId === state.activeSlide.id) return;
    if (state.editMode === "editable" && !(await flushActiveScene())) return;
    await reloadDeck(slideId);
  }

  async function handleAddSlide() {
    if (state.status !== "ok" || !deckId || state.editMode !== "editable")
      return;
    if (!(await flushActiveScene())) return;

    const inserted = await repository.insertSlideAfter(
      deckId,
      state.activeSlide.id,
    );
    setState({
      status: "ok",
      deck: inserted.deck,
      slides: inserted.slides,
      activeSlide: inserted.slide,
      editMode: "editable",
    });
  }

  function toggleSlideChecked(slideId: string) {
    setCheckedSlideIds((previous) => {
      const next = new Set(previous);
      if (next.has(slideId)) {
        next.delete(slideId);
      } else {
        next.add(slideId);
      }
      return next;
    });
  }

  async function handleDeleteSlides() {
    if (state.status !== "ok" || !deckId || state.editMode !== "editable")
      return;
    if (checkedSlideIds.size === 0) return;
    if (!(await flushActiveScene())) return;

    const deleted = await repository.deleteSlides(
      deckId,
      state.activeSlide.id,
      [...checkedSlideIds],
    );
    setCheckedSlideIds(new Set());
    setState({
      status: "ok",
      deck: deleted.deck,
      slides: deleted.slides,
      activeSlide: deleted.activeSlide,
      editMode: "editable",
    });
  }

  async function handleDuplicateSlides() {
    if (state.status !== "ok" || !deckId || state.editMode !== "editable")
      return;
    if (checkedSlideIds.size === 0) return;
    if (!(await flushActiveScene())) return;

    const duplicated = await repository.duplicateSlides(deckId, [
      ...checkedSlideIds,
    ]);
    setCheckedSlideIds(new Set());
    setState({
      status: "ok",
      deck: duplicated.deck,
      slides: duplicated.slides,
      activeSlide:
        duplicated.slides.find((slide) => slide.id === state.activeSlide.id) ??
        state.activeSlide,
      editMode: "editable",
    });
  }

  async function handleSwapSlides() {
    if (state.status !== "ok" || !deckId || state.editMode !== "editable")
      return;
    if (checkedSlideIds.size !== 2) return;
    if (!(await flushActiveScene())) return;

    const [slideIdA, slideIdB] = [...checkedSlideIds];
    const swapped = await repository.swapSlides(deckId, slideIdA!, slideIdB!);
    setCheckedSlideIds(new Set());
    setState({
      status: "ok",
      deck: swapped.deck,
      slides: swapped.slides,
      activeSlide:
        swapped.slides.find((slide) => slide.id === state.activeSlide.id) ??
        state.activeSlide,
      editMode: "editable",
    });
  }

  const slideSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  function handleSlideDragStart(event: DragStartEvent) {
    setActiveDragSlideId(String(event.active.id));
  }

  function handleSlideDragMove(event: DragMoveEvent) {
    if (state.status !== "ok") return;
    const nextInsertion = insertionIndexFromDragPosition(
      event,
      state.deck.slideOrder,
    );
    insertionIndexRef.current = nextInsertion;
    setInsertionIndex(nextInsertion);
  }

  async function commitSlideReorder(slideId: string, insertionIndex: number) {
    if (
      state.status !== "ok" ||
      !deckId ||
      state.editMode !== "editable" ||
      slideReorderInFlightRef.current
    ) {
      return;
    }

    const plan = planSlideInsertion(
      state.deck.slideOrder,
      slideId,
      insertionIndex,
    );
    if (!plan.changed) return;

    slideReorderInFlightRef.current = true;
    setIsSlideReordering(true);
    try {
      const reordered = await repository.reorderSlide(
        deckId,
        slideId,
        insertionIndex,
      );
      setState({
        status: "ok",
        deck: reordered.deck,
        slides: reordered.slides,
        activeSlide:
          reordered.slides.find((slide) => slide.id === state.activeSlide.id) ??
          state.activeSlide,
        editMode: state.editMode,
      });
    } finally {
      slideReorderInFlightRef.current = false;
      setIsSlideReordering(false);
    }
  }

  async function handleSlideDragEnd(event: DragEndEvent) {
    const trackedInsertion = insertionIndexRef.current;
    const finalInsertion =
      state.status === "ok"
        ? insertionIndexFromDragPosition(event, state.deck.slideOrder)
        : null;
    setActiveDragSlideId(null);
    setInsertionIndex(null);
    insertionIndexRef.current = null;
    if (state.status !== "ok" || !deckId || state.editMode !== "editable")
      return;

    const slideId = String(event.active.id);
    const targetInsertion = finalInsertion ?? trackedInsertion;
    if (targetInsertion == null) return;

    await commitSlideReorder(slideId, targetInsertion);
  }

  function handleSlideDragCancel() {
    setActiveDragSlideId(null);
    setInsertionIndex(null);
    insertionIndexRef.current = null;
  }

  async function handleHomeClick(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    setLeaveWarning(false);
    try {
      await autosaveRef.current?.flush();
      navigate("/");
    } catch {
      setLeaveWarning(true);
    }
  }

  async function startPresentation(startIndex: number) {
    if (state.status !== "ok" || !deckId) return;
    setPresentError(false);
    setPresentStartDialogOpen(false);

    // Request fullscreen synchronously, before any await, so real browsers
    // still see the Present click's user activation. The fullscreen state
    // survives the SPA navigation to the presentation route.
    const fullscreenRequest = requestPresentationFullscreen(
      document.documentElement,
    );

    if (state.editMode === "editable") {
      try {
        await autosaveRef.current?.flush();
      } catch {
        setPresentError(true);
        void fullscreenRequest.then((result) => {
          if (result.status === "entered") void exitPresentationFullscreen();
        });
        return;
      }
    }

    navigate(`/decks/${deckId}/present?start=${startIndex}`);
  }

  function handlePresentClick() {
    if (state.status !== "ok") return;
    const activeSlideIndex = state.slides.findIndex(
      (slide) => slide.id === state.activeSlide.id,
    );
    if (activeSlideIndex <= 0) {
      void startPresentation(0);
      return;
    }
    setPresentStartDialogOpen(true);
  }

  function handleSidebarToggle() {
    if (sidebarOpen) {
      clearPreview();
    }
    setSidebarOpen((open) => !open);
  }

  function handleSelectTool(tool: DrawingToolType) {
    const api = excalidrawApiRef.current;
    if (!api || isReadOnlyTooling()) return;
    api.setActiveTool({ type: tool });
    setActiveTool(tool);
  }

  function isReadOnlyTooling(): boolean {
    return state.status !== "ok" || state.editMode === "readonly";
  }

  function handleZoomBy(factor: number) {
    const api = excalidrawApiRef.current;
    if (!api) return;
    const { scrollX, scrollY, zoom, width, height } = api.getAppState();
    if (width <= 0 || height <= 0) return;
    const next = clampCamera(
      { scrollX, scrollY, zoom: zoom.value * factor },
      { width, height },
    );
    api.updateScene({
      appState: {
        scrollX: next.scrollX,
        scrollY: next.scrollY,
        zoom: { value: next.zoom as never },
      },
    });
    setZoomPercent(Math.round(next.zoom * 100));
  }

  function handleResetZoom() {
    slideConstraintsRef.current?.fitSlideToViewport();
    const api = excalidrawApiRef.current;
    if (!api) return;
    const { width, height, zoom } = api.getAppState();
    if (width > 0 && height > 0) {
      setZoomPercent(Math.round(zoom.value * 100));
    }
  }

  async function handleExport(format: "pdf" | "slaide", exportTheme: DeckTheme) {
    if (state.status !== "ok" || !deckId || exporting) return;
    setExportFailureStage(null);
    setExporting(true);

    try {
      if (state.editMode === "editable") {
        try {
          await autosaveRef.current?.flush();
        } catch {
          setExportFailureStage("save");
          return;
        }
      }

      const loaded = await repository.loadDeck(deckId);
      if (loaded.status !== "ok") {
        setState({ status: "unavailable", reason: loaded.status });
        return;
      }

      if (format === "pdf") {
        const { exportDeckAsPdf } = await import("../pdf/export-deck.ts");
        await exportDeckAsPdf(loaded.deck, loaded.slides, exportTheme);
      } else {
        exportDeckAsSlaideFile(loaded.deck, loaded.slides, exportTheme);
      }
    } catch {
      setExportFailureStage("export");
    } finally {
      setExporting(false);
    }
  }

  if (state.status === "loading") {
    return (
      <main className="p-6">
        <p className="text-muted-foreground">Loading deck…</p>
      </main>
    );
  }

  if (state.status === "unavailable") {
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
    );
  }

  const isReadOnly = state.editMode === "readonly";
  const activeSlideIndex = state.slides.findIndex(
    (slide) => slide.id === state.activeSlide.id,
  );
  const initialScene = state.activeSlide.scene;

  return (
    <main className="m-0 flex h-svh max-w-none flex-row overflow-hidden bg-background p-0">
      {sidebarOpen ? (
        <aside
          className="flex w-56 shrink-0 flex-col border-r border-border bg-muted/20"
          aria-label="Slides"
          aria-busy={isSlideReordering}
          data-reordering={isSlideReordering ? "true" : "false"}
        >
          <div className="flex shrink-0 flex-col gap-2 border-b border-border px-2.5 py-2">
            <div className="flex items-center gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
                aria-expanded={true}
                onClick={handleSidebarToggle}
              >
                <PanelLeftClose />
                <span className="sr-only">Collapse sidebar</span>
              </Button>
              <Button type="button" variant="ghost" size="icon-sm" asChild>
                <Link
                  to="/"
                  aria-label="Home"
                  title="Home"
                  onClick={(event) => void handleHomeClick(event)}
                >
                  <Home />
                  <span className="sr-only">Home</span>
                </Link>
              </Button>
              <div className="ml-auto flex items-center gap-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Present"
                  title="Present"
                  onClick={() => handlePresentClick()}
                >
                  <Presentation />
                  <span className="sr-only">Present</span>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={exporting ? "Exporting deck" : "Export deck"}
                      title={exporting ? "Exporting deck" : "Export deck"}
                      disabled={exporting}
                    >
                      {exporting ? (
                        <LoaderCircle className="animate-spin" />
                      ) : (
                        <Download />
                      )}
                      <span className="sr-only">
                        {exporting ? "Exporting…" : "Export"}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onSelect={() => setPendingExportFormat("slaide")}
                    >
                      <FileJson />
                      SLAIDE
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => setPendingExportFormat("pdf")}
                    >
                      <FileText />
                      PDF
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <ThemeSelector />
              </div>
            </div>

            <div className="space-y-1 px-1">
              <h1 className="m-0 truncate text-sm font-semibold leading-tight tracking-tight">
                {state.deck.title}
              </h1>
              <div className="flex items-center justify-between gap-2">
                <p className="m-0 text-[11px] text-muted-foreground">
                  Slide {activeSlideIndex + 1} of {state.slides.length}
                </p>
                {isReadOnly ? null : (
                  <p
                    role="status"
                    aria-live="polite"
                    className={`m-0 text-[11px] tabular-nums ${
                      saveStatus === "failed"
                        ? "font-medium text-destructive"
                        : "text-muted-foreground"
                    }`}
                    data-testid="save-status"
                  >
                    {formatSaveStatus(saveStatus)}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-border px-2.5">
            <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              Slides
            </span>
            <div className="flex items-center gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={isReadOnly}
                aria-label="Add slide"
                title="Add slide"
                onClick={() => void handleAddSlide()}
              >
                <Plus />
                <span className="sr-only">Add slide</span>
              </Button>
              {checkedSlideIds.size > 0 && !isReadOnly ? (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Duplicate"
                    title="Duplicate selected slides"
                    onClick={() => void handleDuplicateSlides()}
                  >
                    <Copy />
                    <span className="sr-only">Duplicate</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Swap"
                    title="Swap selected slides"
                    disabled={checkedSlideIds.size !== 2}
                    onClick={() => void handleSwapSlides()}
                  >
                    <ArrowLeftRight />
                    <span className="sr-only">Swap</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Delete"
                    title="Delete selected slides"
                    onClick={() => void handleDeleteSlides()}
                  >
                    <Trash2 />
                    <span className="sr-only">Delete</span>
                  </Button>
                </>
              ) : null}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
            <DndContext
              sensors={slideSensors}
              onDragStart={handleSlideDragStart}
              onDragMove={handleSlideDragMove}
              onDragEnd={(event) => void handleSlideDragEnd(event)}
              onDragCancel={handleSlideDragCancel}
            >
              <ol className="m-0 flex list-none flex-col gap-0.5 p-0">
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
                      isReadOnly={isReadOnly || isSlideReordering}
                      isDragging={activeDragSlideId === slide.id}
                      slideCount={state.slides.length}
                      isPreviewOpen={previewSession?.slideId === slide.id}
                      previewSession={
                        previewSession?.slideId === slide.id
                          ? previewSession
                          : null
                      }
                      onSelect={() => void handleSelectSlide(slide.id)}
                      onToggleChecked={() => toggleSlideChecked(slide.id)}
                      onTogglePreview={() =>
                        openPreview(slide, slide.id === state.activeSlide.id)
                      }
                      onPreviewRetry={() =>
                        retryPreview(slide, slide.id === state.activeSlide.id)
                      }
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
              <DragOverlay dropAnimation={null}>
                {activeDragSlideId
                  ? (() => {
                      const draggedSlide = state.slides.find(
                        (slide) => slide.id === activeDragSlideId,
                      );
                      const draggedIndex = state.slides.findIndex(
                        (slide) => slide.id === activeDragSlideId,
                      );
                      if (!draggedSlide) return null;
                      return (
                        <SlideRowPreview
                          index={draggedIndex}
                          isActive={draggedSlide.id === state.activeSlide.id}
                          isChecked={checkedSlideIds.has(draggedSlide.id)}
                        />
                      );
                    })()
                  : null}
              </DragOverlay>
            </DndContext>
          </div>

          {!isReadOnly ? (
            <div className="shrink-0 border-t border-border px-2.5 py-2">
              <EditorDrawingTools
                activeTool={activeTool}
                zoomPercent={zoomPercent}
                disabled={isReadOnlyTooling()}
                onSelectTool={handleSelectTool}
                onUndo={() => {
                  clickExcalidrawControl("button-undo");
                }}
                onRedo={() => {
                  clickExcalidrawControl("button-redo");
                }}
                onZoomIn={() => {
                  handleZoomBy(1.1);
                }}
                onZoomOut={() => {
                  handleZoomBy(1 / 1.1);
                }}
                onResetZoom={handleResetZoom}
              />
            </div>
          ) : null}
        </aside>
      ) : (
        <aside
          className="flex w-10 shrink-0 flex-col items-center gap-1 border-r border-border bg-muted/20 py-2"
          aria-label="Editor controls"
        >
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Open sidebar"
            title="Open sidebar"
            aria-expanded={false}
            onClick={handleSidebarToggle}
          >
            <PanelLeftOpen />
            <span className="sr-only">Open sidebar</span>
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" asChild>
            <Link
              to="/"
              aria-label="Home"
              title="Home"
              onClick={(event) => void handleHomeClick(event)}
            >
              <Home />
              <span className="sr-only">Home</span>
            </Link>
          </Button>
        </aside>
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {isReadOnly ? (
          <Alert
            className="rounded-none border-x-0 border-t-0"
            role="status"
            data-testid="readonly-notice"
          >
            <AlertTitle>Read-only</AlertTitle>
            <AlertDescription>
              This deck is open for editing in another tab or window. You can
              view slides here until that session ends.
            </AlertDescription>
          </Alert>
        ) : null}
        {exportFailureStage !== null ? (
          <Alert
            className="rounded-none border-x-0 border-t-0"
            role="alert"
            data-testid="export-error"
          >
            <AlertTitle>Export failed</AlertTitle>
            <AlertDescription>
              {exportFailureStage === "save"
                ? "Your latest changes could not be saved. Fix the save error before exporting."
                : "This deck could not be exported. Try again."}
            </AlertDescription>
          </Alert>
        ) : null}
        {presentError ? (
          <Alert
            className="rounded-none border-x-0 border-t-0"
            role="alert"
            data-testid="present-error"
          >
            <AlertTitle>Presentation failed</AlertTitle>
            <AlertDescription>
              Your latest changes could not be saved. Fix the save error before
              presenting.
            </AlertDescription>
          </Alert>
        ) : null}

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
              <AlertDialogAction onClick={() => navigate("/")}>
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
                  if (state.status !== "ok") return;
                  const activeSlideIndex = state.slides.findIndex(
                    (slide) => slide.id === state.activeSlide.id,
                  );
                  void startPresentation(activeSlideIndex);
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

        <ExportThemeDialog
          format={pendingExportFormat}
          defaultTheme={theme}
          onCancel={() => setPendingExportFormat(null)}
          onConfirm={(exportTheme) => {
            const format = pendingExportFormat;
            setPendingExportFormat(null);
            if (format) {
              void handleExport(format, exportTheme);
            }
          }}
        />

        <div
          ref={editorHostRef}
          className="editor-canvas relative min-h-0 flex-1 bg-muted/30 [&_.excalidraw]:h-full"
          data-testid="excalidraw-host"
        >
          <Excalidraw
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
              event.preventDefault();
              if (element.link) {
                window.open(element.link, "_blank", "noopener,noreferrer");
              }
            }}
            excalidrawAPI={(api) => {
              if (isReadOnly) {
                slideConstraintsRef.current?.dispose();
                slideConstraintsRef.current = null;
                delete window.__slaideTest;
                return;
              }
              excalidrawApiRef.current = api;
              slideConstraintsRef.current?.dispose();
              slideConstraintsRef.current = createSlideConstraintController(
                api,
                () => {
                  const { width, height } = api.getAppState();
                  if (width <= 0 || height <= 0) {
                    return null;
                  }
                  return { width, height };
                },
              );
              requestAnimationFrame(() => {
                slideConstraintsRef.current?.fitSlideToViewport();
                const { zoom } = api.getAppState();
                setZoomPercent(Math.round(zoom.value * 100));
              });
              window.__slaideTest = {
                addRectangle() {
                  const created = convertToExcalidrawElements([
                    {
                      type: "rectangle",
                      x: 120,
                      y: 140,
                      width: 220,
                      height: 120,
                    },
                  ]);
                  api.updateScene({
                    elements: [...api.getSceneElements(), ...created],
                  });
                },
                moveRectangleOffSlide() {
                  const elements = api.getSceneElements();
                  const rectangle = elements.find(
                    (element) => element.type === "rectangle",
                  );
                  if (!rectangle) {
                    throw new Error("rectangle missing");
                  }
                  const moved = newElementWith(rectangle, { x: 1800, y: 980 });
                  api.updateScene({
                    elements: elements.map((element) =>
                      element.id === moved.id ? moved : element,
                    ),
                  });
                  slideConstraintsRef.current?.enforceElementsForTest();
                },
                addOversizedRectangle() {
                  const created = convertToExcalidrawElements([
                    {
                      type: "rectangle",
                      x: 0,
                      y: 0,
                      width: SLIDE_WIDTH * 2,
                      height: SLIDE_HEIGHT * 2,
                    },
                  ]);
                  api.updateScene({
                    elements: constrainAllElements([
                      ...api.getSceneElements(),
                      ...created,
                    ]),
                  });
                },
                getElementCount() {
                  return api.getSceneElements().length;
                },
                getSceneElementCount() {
                  return api.getSceneElements().length;
                },
                getCamera() {
                  const { scrollX, scrollY, zoom } = api.getAppState();
                  return { scrollX, scrollY, zoom: zoom.value };
                },
                getViewport() {
                  const { width, height } = api.getAppState();
                  return { width, height };
                },
                getElementGeometry() {
                  return api.getSceneElements().map((element) => ({
                    id: element.id,
                    x: element.x,
                    y: element.y,
                    width: element.width,
                    height: element.height,
                  }));
                },
                setCamera(camera) {
                  const current = api.getAppState();
                  api.updateScene({
                    appState: {
                      scrollX: camera.scrollX ?? current.scrollX,
                      scrollY: camera.scrollY ?? current.scrollY,
                      zoom: {
                        value: (camera.zoom ?? current.zoom.value) as never,
                      },
                    },
                  });
                  slideConstraintsRef.current?.correctCamera();
                },
                getStoredElementsInsideSlide() {
                  return allElementsInsideSlide(api.getSceneElements());
                },
              };
            }}
            onDuplicate={(nextElements, previousElements) =>
              constrainElementsAfterGesture(
                nextElements,
                toElementsMap(previousElements),
              )
            }
            onChange={(elements, appState, files) => {
              if (isReadOnly) return;
              const toolType = appState.activeTool?.type;
              if (typeof toolType === "string") {
                setActiveTool(toolType);
              }
              setZoomPercent(Math.round(appState.zoom.value * 100));
              const nextTheme = appState.theme;
              if (nextTheme === "light" || nextTheme === "dark") {
                if (nextTheme === themeFromAppRef.current) {
                  suppressExcalidrawThemeSyncRef.current = false;
                } else if (!suppressExcalidrawThemeSyncRef.current) {
                  themeFromAppRef.current = nextTheme;
                  void setThemePreference(nextTheme);
                }
              }
              if (slideConstraintsRef.current?.isGestureActive()) {
                return;
              }
              if (!allElementsInsideSlide(elements as never[])) {
                return;
              }
              const scene = toPersistentScene(
                elements,
                appState as unknown as Record<string, unknown>,
                files as unknown as Record<string, unknown>,
              );
              autosaveRef.current?.schedule(scene);
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
  );
}

function formatSaveStatus(status: SaveStatus): string {
  switch (status) {
    case "saving":
      return "Saving…";
    case "failed":
      return "Save failed";
    case "saved":
      return "Saved";
  }
}

type SortableSlideRowProps = {
  slide: Slide;
  index: number;
  isActive: boolean;
  isChecked: boolean;
  isReadOnly: boolean;
  isDragging: boolean;
  slideCount: number;
  isPreviewOpen: boolean;
  previewSession: SlidePreviewSession | null;
  onSelect: () => void;
  onToggleChecked: () => void;
  onTogglePreview: () => void;
  onPreviewRetry: () => void;
  onKeyboardReorder: (insertionIndex: number) => void;
};

function SortableSlideRow({
  slide,
  index,
  isActive,
  isChecked,
  isReadOnly,
  isDragging,
  slideCount,
  isPreviewOpen,
  previewSession,
  onSelect,
  onToggleChecked,
  onTogglePreview,
  onPreviewRetry,
  onKeyboardReorder,
}: SortableSlideRowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform } =
    useDraggable({
      id: slide.id,
      disabled: isReadOnly,
    });

  const style = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.35 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="group flex flex-col gap-0"
      data-slide-id={slide.id}
    >
      <div className="flex items-start gap-1.5">
        <div className="flex w-5 shrink-0 flex-col items-center gap-1 pt-1">
          <button
            type="button"
            ref={setActivatorNodeRef}
            className="inline-flex size-5 items-center justify-center rounded text-muted-foreground/70 transition-colors hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:text-foreground disabled:pointer-events-none disabled:opacity-30"
            aria-label={`Reorder slide ${index + 1}`}
            disabled={isReadOnly}
            onClick={(event) => event.preventDefault()}
            {...attributes}
            {...listeners}
            onKeyDown={(event) => {
              if (listeners?.onKeyDown) {
                listeners.onKeyDown(event);
              }
              if (event.defaultPrevented || isDragging) return;

              if (event.key === "ArrowDown") {
                event.preventDefault();
                onKeyboardReorder(Math.min(index + 2, slideCount));
              } else if (event.key === "ArrowUp" && index > 0) {
                event.preventDefault();
                onKeyboardReorder(index);
              }
            }}
          >
            <GripVertical className="size-3.5" aria-hidden="true" />
          </button>
          <input
            type="checkbox"
            className="size-3.5 shrink-0 accent-primary"
            checked={isChecked}
            disabled={isReadOnly}
            aria-label={`Select slide ${index + 1}`}
            onChange={onToggleChecked}
            onClick={(event) => event.stopPropagation()}
          />
          <button
            type="button"
            className="inline-flex size-5 items-center justify-center rounded text-muted-foreground/70 transition-colors hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:text-foreground disabled:pointer-events-none disabled:opacity-30"
            aria-label={`Preview slide ${index + 1}`}
            aria-expanded={isPreviewOpen}
            disabled={isReadOnly}
            onClick={(event) => {
              event.stopPropagation();
              onTogglePreview();
            }}
          >
            <Eye className="size-3.5" aria-hidden="true" />
          </button>
        </div>
        <div className="relative min-w-0 flex-1">
          <Button
            type="button"
            variant="outline"
            className={`h-auto w-full flex-col gap-0 overflow-hidden rounded-md border p-0 shadow-none ${
              isActive
                ? "border-primary ring-2 ring-primary/30"
                : "border-border hover:border-foreground/25"
            }`}
            aria-current={isActive ? "true" : undefined}
            onClick={onSelect}
          >
            <span className="flex aspect-video w-full items-center justify-center bg-card text-sm font-medium tabular-nums text-muted-foreground">
              {index + 1}
            </span>
          </Button>
          {previewSession ? (
            <SlidePreviewPanel
              slideNumber={index + 1}
              state={previewSession.panelState}
              imageUrl={previewSession.imageUrl}
              onRetry={onPreviewRetry}
            />
          ) : null}
        </div>
      </div>
    </li>
  );
}

function SlideRowPreview({
  index,
  isActive,
  isChecked,
}: {
  index: number;
  isActive: boolean;
  isChecked: boolean;
}) {
  return (
    <div className="flex w-44 flex-col gap-0 rounded-md bg-background p-1 shadow-md">
      <div className="flex items-start gap-1.5">
        <div className="flex w-5 shrink-0 flex-col items-center gap-1 pt-1">
          <span className="inline-flex size-5 items-center justify-center text-muted-foreground">
            <GripVertical className="size-3.5" aria-hidden="true" />
          </span>
          <input
            type="checkbox"
            className="size-3.5 shrink-0 accent-primary"
            checked={isChecked}
            readOnly
            aria-hidden="true"
            tabIndex={-1}
          />
          <span className="inline-flex size-5 items-center justify-center text-muted-foreground">
            <Eye className="size-3.5" aria-hidden="true" />
          </span>
        </div>
        <div
          className={`min-w-0 flex-1 overflow-hidden rounded-md border ${
            isActive ? "border-primary ring-2 ring-primary/30" : "border-border"
          }`}
        >
          <span className="flex aspect-video w-full items-center justify-center bg-card text-sm font-medium tabular-nums text-muted-foreground">
            {index + 1}
          </span>
        </div>
      </div>
    </div>
  );
}

function SlideInsertionIndicator({
  index,
  active,
}: {
  index: number;
  active: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `insertion-${index}`,
    data: { type: "insertion", index },
  });

  const showIndicator = active || isOver;

  return (
    <div
      ref={setNodeRef}
      data-testid={`slide-insertion-${index}`}
      className="relative z-10 -my-2 h-5"
      aria-hidden="true"
    >
      <div
        className={`absolute inset-x-2 top-1/2 -translate-y-1/2 rounded-full transition-all ${
          showIndicator
            ? "h-0.5 bg-primary shadow-[0_0_0_2px_var(--color-primary)]"
            : "h-px bg-transparent"
        }`}
      />
    </div>
  );
}

function insertionIndexFromDragPosition(
  event: DragMoveEvent | DragEndEvent,
  slideOrder: readonly string[],
): number | null {
  const activator = event.activatorEvent;
  const initialPointerY =
    "clientY" in activator && typeof activator.clientY === "number"
      ? activator.clientY
      : null;
  const dragged = event.active.rect.current.translated;
  const pointerY =
    initialPointerY == null
      ? dragged
        ? dragged.top + dragged.height / 2
        : null
      : initialPointerY + event.delta.y;
  if (pointerY == null) return null;

  const activeId = String(event.active.id);

  for (let index = 0; index < slideOrder.length; index += 1) {
    const slideId = slideOrder[index];
    if (slideId === activeId) continue;

    const row = document.querySelector<HTMLElement>(
      `[data-slide-id="${globalThis.CSS.escape(slideId!)}"]`,
    );
    if (!row) continue;

    const rowRect = row.getBoundingClientRect();
    if (pointerY < rowRect.top + rowRect.height / 2) {
      return index;
    }
  }

  return slideOrder.length;
}
