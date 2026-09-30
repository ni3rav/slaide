import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { useDeckRepository } from '../storage/deck-repository-context.tsx'
import type { Slide } from '../storage/deck-repository.ts'
import {
  createPresentationImageCache,
  type PresentationImageCache,
} from '../presentation/presentation-image-cache.ts'
import { renderSlideToPngBlob } from '../presentation/slide-to-png.ts'
import { useTheme } from './ThemeProvider.tsx'
import { canAcceptPresentationNavigation } from '../presentation/presentation-navigation-throttle.ts'
import { consumePresenterWindowBlocked } from '../presentation/open-presenter-window.ts'
import { usePresenterSync } from '../presentation/use-presenter-sync.ts'
import {
  exitPresentationFullscreen,
  requestPresentationFullscreen,
} from '../presentation/request-fullscreen.ts'
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, X, Maximize } from 'lucide-react'

type PresentationState =
  | { status: 'loading' }
  | { status: 'unavailable' }
  | {
      status: 'ready'
      slides: Slide[]
      currentIndex: number
      imageUrl: string | null
      imageError: boolean
      failedTargetIndex: number | null
      fullscreenDenied: boolean
      fullscreenWarningDismissed: boolean
    }

type PresentationTestApi = {
  getActiveObjectUrlCount: () => number
  getCurrentSlideIndex: () => number
  isFullscreenDenied: () => boolean
}

declare global {
  interface Window {
    __slaidePresentationTest?: PresentationTestApi
    __slaidePresentationRenderDelayMs?: number
    __slaidePresentationFailSlideIds?: string[]
  }
}

function parseStartIndex(value: string | null, slideCount: number): number {
  if (!value) return 0
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 0) return 0
  if (parsed >= slideCount) return Math.max(0, slideCount - 1)
  return parsed
}

export function PresentationPage() {
  const { deckId } = useParams<{ deckId: string }>()
  const [searchParams] = useSearchParams()
  const repository = useDeckRepository()
  const navigate = useNavigate()
  const { theme } = useTheme()
  // Read at cache creation so all slides render with the app theme active when
  // the presentation started. A ref avoids restarting the session on unrelated
  // re-renders while still capturing the latest theme.
  const themeRef = useRef(theme)
  const overlayRef = useRef<HTMLDivElement>(null)
  const cacheRef = useRef<PresentationImageCache | null>(null)
  const fullscreenEnteredRef = useRef(false)
  const exitingRef = useRef(false)
  const navigationRequestRef = useRef(0)
  const lastNavigationAtRef = useRef<number | null>(null)
  const publishIndexRef = useRef<(index: number) => void>(() => {})
  const publishExitRef = useRef<() => void>(() => {})
  const [state, setState] = useState<PresentationState>({ status: 'loading' })
  const [presenterBlocked, setPresenterBlocked] = useState(consumePresenterWindowBlocked)

  useEffect(() => {
    themeRef.current = theme
  }, [theme])

  const exitPresentation = useCallback(() => {
    if (exitingRef.current) return
    exitingRef.current = true
    publishExitRef.current()
    fullscreenEnteredRef.current = false
    cacheRef.current?.revokeAll()
    cacheRef.current = null
    delete window.__slaidePresentationTest
    void exitPresentationFullscreen()
    if (deckId) {
      navigate(`/decks/${deckId}`, { replace: true })
    } else {
      navigate('/', { replace: true })
    }
  }, [deckId, navigate])

  const loadSlideImage = useCallback(
    async (slides: Slide[], index: number, cache: PresentationImageCache) => {
      const slide = slides[index]
      if (!slide) {
        setState({ status: 'unavailable' })
        return
      }

      const request = ++navigationRequestRef.current

      setState((previous) =>
        previous.status === 'ready' && previous.currentIndex === index
          ? {
              ...previous,
              imageUrl: null,
              imageError: false,
              failedTargetIndex: null,
            }
          : previous,
      )

      try {
        const imageUrl = await cache.getObjectUrl(slide.id, slide.scene)
        await preloadPresentationImage(imageUrl)
        if (request !== navigationRequestRef.current) return

        setState((previous) =>
          previous.status === 'ready' && previous.currentIndex === index
            ? {
                ...previous,
                imageUrl,
                imageError: false,
                failedTargetIndex: null,
              }
            : previous,
        )
        cache.ensureWindow(slides, index)
      } catch {
        if (request !== navigationRequestRef.current) return
        setState((previous) =>
          previous.status === 'ready' && previous.currentIndex === index
            ? {
                ...previous,
                imageUrl: null,
                imageError: true,
                failedTargetIndex: index,
              }
            : previous,
        )
      }
    },
    [],
  )

  useEffect(() => {
    if (!deckId) {
      setState({ status: 'unavailable' })
      return
    }

    let cancelled = false
    const cache = createPresentationImageCache((scene) =>
      renderSlideToPngBlob(scene, themeRef.current),
    )
    cacheRef.current = cache

    async function start() {
      exitingRef.current = false
      const result = await repository.loadDeck(deckId!)
      if (cancelled) return

      if (result.status !== 'ok' || result.slides.length === 0) {
        setState({ status: 'unavailable' })
        return
      }

      const startIndex = parseStartIndex(
        searchParams.get('start'),
        result.slides.length,
      )

      cache.ensureWindow(result.slides, startIndex)

      setState({
        status: 'ready',
        slides: result.slides,
        currentIndex: startIndex,
        imageUrl: null,
        imageError: false,
        failedTargetIndex: null,
        fullscreenDenied: false,
        fullscreenWarningDismissed: false,
      })

      window.__slaidePresentationTest = {
        getActiveObjectUrlCount: () => cache.getActiveUrlCount(),
        getCurrentSlideIndex: () => startIndex,
        isFullscreenDenied: () => false,
      }

      await loadSlideImage(result.slides, startIndex, cache)
    }

    void start()

    return () => {
      cancelled = true
      cache.revokeAll()
      cacheRef.current = null
      navigationRequestRef.current += 1
      delete window.__slaidePresentationTest
      if (fullscreenEnteredRef.current) {
        fullscreenEnteredRef.current = false
        void exitPresentationFullscreen()
      }
    }
  }, [deckId, loadSlideImage, repository, searchParams])

  useEffect(() => {
    if (state.status !== 'ready') return

    if (document.fullscreenElement) {
      fullscreenEnteredRef.current = true
      return
    }

    const timer = setTimeout(() => {
      if (document.fullscreenElement) {
        fullscreenEnteredRef.current = true
        return
      }
      setState((previous) =>
        previous.status === 'ready'
          ? { ...previous, fullscreenDenied: true }
          : previous,
      )
    }, 500)

    return () => clearTimeout(timer)
  }, [state.status])

  const enterFullscreen = useCallback(() => {
    const overlay = overlayRef.current
    if (!overlay) return
    void requestPresentationFullscreen(overlay).then((result) => {
      if (result.status !== 'entered') return
      fullscreenEnteredRef.current = true
      setState((previous) =>
        previous.status === 'ready'
          ? { ...previous, fullscreenDenied: false }
          : previous,
      )
    })
  }, [])

  const dismissFullscreenWarning = useCallback(() => {
    setState((previous) =>
      previous.status === 'ready'
        ? { ...previous, fullscreenWarningDismissed: true }
        : previous,
    )
  }, [])

  useEffect(() => {
    if (state.status !== 'ready') return
    overlayRef.current?.focus()
  }, [state.status, state.status === 'ready' ? state.currentIndex : null])

  useEffect(() => {
    if (state.status !== 'ready') return

    window.__slaidePresentationTest = {
      getActiveObjectUrlCount: () => cacheRef.current?.getActiveUrlCount() ?? 0,
      getCurrentSlideIndex: () => state.currentIndex,
      isFullscreenDenied: () => state.fullscreenDenied,
    }
  }, [state])

  const goToSlide = useCallback(
    (nextIndex: number, source: 'local' | 'remote' = 'local') => {
      if (
        state.status !== 'ready' ||
        nextIndex === state.currentIndex ||
        nextIndex < 0 ||
        nextIndex >= state.slides.length ||
        !cacheRef.current
      ) {
        return
      }

      if (source === 'local') {
        const now = Date.now()
        if (!canAcceptPresentationNavigation(lastNavigationAtRef.current, now)) {
          return
        }
        lastNavigationAtRef.current = now
      }

      const slide = state.slides[nextIndex]
      if (!slide) return

      const cache = cacheRef.current
      const request = ++navigationRequestRef.current
      const cachedUrl = cache.getCachedObjectUrl(slide.id)

      cache.ensureWindow(state.slides, nextIndex)

      setState((previous) =>
        previous.status === 'ready'
          ? {
              ...previous,
              currentIndex: nextIndex,
              imageUrl: cachedUrl,
              imageError: false,
              failedTargetIndex: null,
            }
          : previous,
      )
      publishIndexRef.current(nextIndex)

      void (async () => {
        try {
          const imageUrl = await cache.getObjectUrl(slide.id, slide.scene)
          await preloadPresentationImage(imageUrl)
          if (request !== navigationRequestRef.current) return

          setState((previous) =>
            previous.status === 'ready' && previous.currentIndex === nextIndex
              ? {
                  ...previous,
                  imageUrl,
                  imageError: false,
                  failedTargetIndex: null,
                }
              : previous,
          )
        } catch {
          if (request !== navigationRequestRef.current) return
          setState((previous) =>
            previous.status === 'ready' && previous.currentIndex === nextIndex
              ? {
                  ...previous,
                  imageUrl: null,
                  imageError: true,
                  failedTargetIndex: nextIndex,
                }
              : previous,
          )
        }
      })()
    },
    [state],
  )

  const currentIndexRef = useRef(0)
  if (state.status === 'ready') currentIndexRef.current = state.currentIndex

  const presenterSync = usePresenterSync({
    deckId,
    role: 'audience',
    enabled: state.status === 'ready',
    getIndex: () => (state.status === 'ready' ? currentIndexRef.current : null),
    onIndex: () => {},
    onGo: (index) => goToSlide(index, 'remote'),
    onExit: exitPresentation,
  })
  publishIndexRef.current = presenterSync.publishIndex
  publishExitRef.current = presenterSync.publishExit

  const goNext = useCallback(() => {
    if (state.status !== 'ready') return
    if (state.currentIndex >= state.slides.length - 1) return
    goToSlide(state.currentIndex + 1)
  }, [goToSlide, state])

  const goPrevious = useCallback(() => {
    if (state.status !== 'ready') return
    if (state.currentIndex <= 0) return
    goToSlide(state.currentIndex - 1)
  }, [goToSlide, state])

  useEffect(() => {
    if (state.status !== 'ready') return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        goNext()
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        goPrevious()
      } else if (event.key === 'Escape') {
        event.preventDefault()
        exitPresentation()
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [exitPresentation, goNext, goPrevious, state.status])

  useEffect(() => {
    if (state.status !== 'ready') return

    function handleFullscreenChange() {
      if (exitingRef.current) return

      if (document.fullscreenElement) {
        fullscreenEnteredRef.current = true
        setState((previous) =>
          previous.status === 'ready'
            ? { ...previous, fullscreenDenied: false }
            : previous,
        )
        return
      }

      if (!fullscreenEnteredRef.current) return
      fullscreenEnteredRef.current = false
      exitPresentation()
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [exitPresentation, state.status])

  if (state.status === 'loading') {
    return (
      <main className="p-6">
        <p className="text-muted-foreground">Preparing presentation…</p>
      </main>
    )
  }

  if (state.status === 'unavailable') {
    return (
      <main className="mx-auto max-w-lg space-y-4 p-6">
        <h1 className="text-2xl font-semibold">Presentation unavailable</h1>
        <p className="text-muted-foreground">This deck could not be presented.</p>
        <Button type="button" onClick={() => navigate('/')}>
          Return home
        </Button>
      </main>
    )
  }

  const {
    slides,
    currentIndex,
    imageUrl,
    imageError,
    failedTargetIndex,
    fullscreenDenied,
    fullscreenWarningDismissed,
  } = state
  const slideNumber = currentIndex + 1

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex flex-col bg-black text-white"
      data-testid="presentation-overlay"
      role="application"
      aria-label="Presentation mode"
      tabIndex={-1}
    >
      {presenterBlocked ? (
        <Alert
          className="absolute top-4 right-16 z-10 max-w-sm border-white/15 bg-neutral-950/90 text-white"
          role="status"
          data-testid="presenter-blocked"
        >
          <AlertTitle>Presenter window blocked</AlertTitle>
          <AlertDescription className="text-white/80">
            The browser blocked the presenter window. Slides still show here.
          </AlertDescription>
          <AlertAction>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-white/70 hover:bg-white/10 hover:text-white"
              aria-label="Dismiss presenter warning"
              title="Dismiss presenter warning"
              onClick={() => setPresenterBlocked(false)}
            >
              <X />
            </Button>
          </AlertAction>
        </Alert>
      ) : null}
      {fullscreenDenied && !fullscreenWarningDismissed ? (
        <Alert
          className="absolute top-4 left-4 z-10 max-w-md border-amber-500/50 bg-amber-950/90 text-amber-50"
          role="status"
          aria-label="Fullscreen unavailable"
          data-testid="fullscreen-warning"
        >
          <AlertTitle>Fullscreen unavailable</AlertTitle>
          <AlertDescription className="text-amber-50/80">
            Presentation continues in this window. Press Escape to exit.
          </AlertDescription>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-2 justify-self-start"
            onClick={enterFullscreen}
          >
            <Maximize />
            Enter fullscreen
          </Button>
          <AlertAction>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-amber-50/70 hover:bg-amber-50/10 hover:text-amber-50"
              aria-label="Dismiss fullscreen warning"
              title="Dismiss fullscreen warning"
              onClick={dismissFullscreenWarning}
            >
              <X />
            </Button>
          </AlertAction>
        </Alert>
      ) : null}
      {fullscreenDenied && fullscreenWarningDismissed ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute top-4 right-14 text-white/70 hover:bg-white/10 hover:text-white"
          aria-label="Enter fullscreen"
          title="Enter fullscreen"
          onClick={enterFullscreen}
        >
          <Maximize />
        </Button>
      ) : null}

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4">
        {imageError && !imageUrl ? (
          <div className="space-y-4 text-center" onClick={(event) => event.stopPropagation()}>
            <p>
              Could not render slide {(failedTargetIndex ?? currentIndex) + 1}.
            </p>
            <div className="flex justify-center gap-2">
              <Button
                type="button"
                variant="secondary"
                data-testid="presentation-retry"
                onClick={() => {
                  const retryIndex = failedTargetIndex ?? currentIndex
                  if (cacheRef.current) {
                    void loadSlideImage(slides, retryIndex, cacheRef.current)
                  }
                }}
              >
                Retry
              </Button>
              <Button
                type="button"
                variant="outline"
                data-testid="presentation-exit"
                onClick={exitPresentation}
              >
                Exit
              </Button>
            </div>
          </div>
        ) : imageUrl ? (
          <img
            key={imageUrl}
            src={imageUrl}
            alt={`Slide ${slideNumber} of ${slides.length}`}
            className="max-h-full max-w-full object-contain"
            data-testid="presentation-slide-image"
            draggable={false}
          />
        ) : (
          <p className="text-muted-foreground" data-testid="presentation-loading">
            Loading slide {slideNumber}…
          </p>
        )}
      </div>

      <Button
        type="button"
        variant="secondary"
        size="icon-lg"
        className="absolute top-1/2 left-4 -translate-y-1/2 rounded-full bg-black/55 text-white opacity-70 backdrop-blur hover:bg-black/75 hover:text-white hover:opacity-100 disabled:opacity-20"
        aria-label="Previous slide"
        title="Previous slide"
        disabled={currentIndex === 0}
        onClick={goPrevious}
      >
        <ChevronLeft />
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="icon-lg"
        className="absolute top-1/2 right-4 -translate-y-1/2 rounded-full bg-black/55 text-white opacity-70 backdrop-blur hover:bg-black/75 hover:text-white hover:opacity-100 disabled:opacity-20"
        aria-label="Next slide"
        title="Next slide"
        disabled={currentIndex === slides.length - 1}
        onClick={goNext}
      >
        <ChevronRight />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="absolute top-4 right-4 text-white/70 hover:bg-white/10 hover:text-white"
        aria-label="Exit presentation"
        title="Exit presentation"
        onClick={exitPresentation}
      >
        <X />
      </Button>

      <p
        className="pointer-events-none absolute bottom-4 left-4 text-sm text-white/70"
        aria-live="polite"
        data-testid="presentation-slide-counter"
      >
        Slide {slideNumber} of {slides.length}
      </p>
    </div>
  )
}

function preloadPresentationImage(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('Presentation image failed to load'))
    image.src = url
  })
}
