import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { useDeckRepository } from '../storage/deck-repository-context.tsx'
import type { Slide } from '../storage/deck-repository.ts'
import {
  createPresentationImageCache,
  type PresentationImageCache,
} from '../presentation/presentation-image-cache.ts'
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
import { ChevronLeft, ChevronRight, LoaderCircle, Maximize, X } from 'lucide-react'

type PresentationState =
  | { status: 'loading' }
  | { status: 'unavailable' }
  | {
      status: 'ready'
      slides: Slide[]
      currentIndex: number
      imageUrl: string | null
      previousImageUrl: string | null
      imageError: boolean
      failedTargetIndex: number | null
      isNavigating: boolean
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
  const overlayRef = useRef<HTMLDivElement>(null)
  const cacheRef = useRef<PresentationImageCache | null>(null)
  const fullscreenEnteredRef = useRef(false)
  const exitingRef = useRef(false)
  const navigationRequestRef = useRef(0)
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [state, setState] = useState<PresentationState>({ status: 'loading' })

  const exitPresentation = useCallback(() => {
    exitingRef.current = true
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

      setState((previous) =>
        previous.status === 'ready'
          ? {
              ...previous,
              currentIndex: index,
              imageUrl: null,
              previousImageUrl: null,
              imageError: false,
              failedTargetIndex: null,
              isNavigating: true,
            }
          : previous,
      )

      try {
        const imageUrl = await cache.getObjectUrl(slide.id, slide.scene)
        await preloadPresentationImage(imageUrl)
        setState((previous) =>
          previous.status === 'ready' && previous.currentIndex === index
            ? {
                ...previous,
                imageUrl,
                imageError: false,
                failedTargetIndex: null,
                isNavigating: false,
              }
            : previous,
        )
      } catch {
        setState((previous) =>
          previous.status === 'ready' && previous.currentIndex === index
            ? {
                ...previous,
                imageUrl: null,
                imageError: true,
                failedTargetIndex: index,
                isNavigating: false,
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
    const cache = createPresentationImageCache()
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

      setState({
        status: 'ready',
        slides: result.slides,
        currentIndex: startIndex,
        imageUrl: null,
        previousImageUrl: null,
        imageError: false,
        failedTargetIndex: null,
        isNavigating: true,
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
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current)
      }
      delete window.__slaidePresentationTest
      // Only release fullscreen this page adopted; an unconditional exit
      // would tear down the fullscreen entered from the editor's Present
      // click during StrictMode's mount/cleanup/mount cycle.
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

    // Fullscreen is requested from the editor's Present click (the user
    // gesture); that request may still be resolving, so wait briefly before
    // falling back to in-page presentation.
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
    async (nextIndex: number) => {
      if (
        state.status !== 'ready' ||
        state.isNavigating ||
        nextIndex === state.currentIndex ||
        nextIndex < 0 ||
        nextIndex >= state.slides.length ||
        !cacheRef.current
      ) {
        return
      }

      const slide = state.slides[nextIndex]
      if (!slide) return

      const request = ++navigationRequestRef.current
      setState((previous) =>
        previous.status === 'ready'
          ? {
              ...previous,
              imageError: false,
              failedTargetIndex: null,
              isNavigating: true,
            }
          : previous,
      )

      try {
        const imageUrl = await cacheRef.current.getObjectUrl(slide.id, slide.scene)
        await preloadPresentationImage(imageUrl)
        if (request !== navigationRequestRef.current) return

        setState((previous) =>
          previous.status === 'ready'
            ? {
                ...previous,
                currentIndex: nextIndex,
                previousImageUrl: previous.imageUrl,
                imageUrl,
                imageError: false,
                failedTargetIndex: null,
                isNavigating: false,
              }
            : previous,
        )

        if (transitionTimerRef.current) {
          clearTimeout(transitionTimerRef.current)
        }
        transitionTimerRef.current = setTimeout(() => {
          setState((previous) =>
            previous.status === 'ready'
              ? { ...previous, previousImageUrl: null }
              : previous,
          )
          transitionTimerRef.current = null
        }, 250)
      } catch {
        if (request !== navigationRequestRef.current) return
        setState((previous) =>
          previous.status === 'ready'
            ? {
                ...previous,
                imageError: true,
                failedTargetIndex: nextIndex,
                isNavigating: false,
              }
            : previous,
        )
      }
    },
    [state],
  )

  const goNext = useCallback(() => {
    if (state.status !== 'ready') return
    if (state.currentIndex >= state.slides.length - 1) return
    void goToSlide(state.currentIndex + 1)
  }, [goToSlide, state])

  const goPrevious = useCallback(() => {
    if (state.status !== 'ready') return
    if (state.currentIndex <= 0) return
    void goToSlide(state.currentIndex - 1)
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
      setState((previous) =>
        previous.status === 'ready'
          ? { ...previous, fullscreenDenied: true }
          : previous,
      )
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [state.status])

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
    previousImageUrl,
    imageError,
    failedTargetIndex,
    isNavigating,
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
                onClick={() => {
                  const retryIndex = failedTargetIndex ?? currentIndex
                  if (imageUrl) {
                    void goToSlide(retryIndex)
                  } else if (cacheRef.current) {
                    void loadSlideImage(slides, retryIndex, cacheRef.current)
                  }
                }}
              >
                Retry
              </Button>
              <Button type="button" variant="outline" onClick={exitPresentation}>
                Exit
              </Button>
            </div>
          </div>
        ) : imageUrl ? (
          <div className="relative flex h-full w-full items-center justify-center">
            {previousImageUrl ? (
              <img
                src={previousImageUrl}
                alt=""
                aria-hidden="true"
                className="absolute max-h-full max-w-full object-contain"
                draggable={false}
              />
            ) : null}
            <img
              key={imageUrl}
              src={imageUrl}
              alt={`Slide ${slideNumber} of ${slides.length}`}
              className="relative max-h-full max-w-full animate-in object-contain fade-in duration-250"
              data-testid="presentation-slide-image"
              draggable={false}
            />
            {imageError ? (
              <div
                className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-lg bg-red-950/90 px-3 py-2 text-sm text-red-50 shadow-lg backdrop-blur"
                role="alert"
              >
                <span>
                  Could not render slide {(failedTargetIndex ?? currentIndex) + 1}.
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => void goToSlide(failedTargetIndex ?? currentIndex)}
                >
                  Retry
                </Button>
              </div>
            ) : null}
          </div>
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
        disabled={currentIndex === 0 || isNavigating}
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
        disabled={currentIndex === slides.length - 1 || isNavigating}
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
      {isNavigating && imageUrl ? (
        <div
          className="pointer-events-none absolute right-4 bottom-4 flex items-center gap-1.5 rounded-full bg-black/55 px-2 py-1 text-xs text-white/80 backdrop-blur"
          aria-live="polite"
        >
          <LoaderCircle className="size-3 animate-spin" />
          Preparing slide…
        </div>
      ) : null}

      <p
        className="pointer-events-none absolute bottom-4 left-4 text-sm text-white/70"
        aria-live="polite"
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
