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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

type PresentationState =
  | { status: 'loading' }
  | { status: 'unavailable' }
  | {
      status: 'ready'
      slides: Slide[]
      currentIndex: number
      imageUrl: string | null
      imageError: boolean
      fullscreenDenied: boolean
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
  const [state, setState] = useState<PresentationState>({ status: 'loading' })

  const exitPresentation = useCallback(() => {
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
              imageError: false,
            }
          : previous,
      )

      try {
        const imageUrl = await cache.getObjectUrl(slide.id, slide.scene)
        setState((previous) =>
          previous.status === 'ready' && previous.currentIndex === index
            ? { ...previous, imageUrl, imageError: false }
            : previous,
        )
      } catch {
        setState((previous) =>
          previous.status === 'ready' && previous.currentIndex === index
            ? { ...previous, imageUrl: null, imageError: true }
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
        imageError: false,
        fullscreenDenied: false,
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
      delete window.__slaidePresentationTest
      void exitPresentationFullscreen()
    }
  }, [deckId, loadSlideImage, repository, searchParams])

  useEffect(() => {
    if (state.status !== 'ready') return
    const overlay = overlayRef.current
    if (!overlay) return

    let cancelled = false
    void requestPresentationFullscreen(overlay).then((result) => {
      if (cancelled) return
      if (result.status === 'entered') {
        fullscreenEnteredRef.current = true
        return
      }
      setState((previous) =>
        previous.status === 'ready'
          ? { ...previous, fullscreenDenied: true }
          : previous,
      )
      window.__slaidePresentationTest = {
        getActiveObjectUrlCount: () => cacheRef.current?.getActiveUrlCount() ?? 0,
        getCurrentSlideIndex: () =>
          state.status === 'ready' ? state.currentIndex : 0,
        isFullscreenDenied: () => true,
      }
    })

    return () => {
      cancelled = true
    }
  }, [state.status])

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
    (nextIndex: number) => {
      if (state.status !== 'ready' || !cacheRef.current) return
      const cache = cacheRef.current
      void loadSlideImage(state.slides, nextIndex, cache)
    },
    [loadSlideImage, state],
  )

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
      if (!fullscreenEnteredRef.current || document.fullscreenElement) return
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

  const { slides, currentIndex, imageUrl, imageError, fullscreenDenied } = state
  const slideNumber = currentIndex + 1

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex flex-col bg-black text-white"
      data-testid="presentation-overlay"
      role="application"
      aria-label="Presentation mode"
      tabIndex={-1}
      onClick={goNext}
    >
      {fullscreenDenied ? (
        <Alert
          className="absolute top-4 right-4 left-4 z-10 max-w-md border-amber-500/50 bg-amber-950/90 text-amber-50"
          role="status"
          data-testid="fullscreen-warning"
        >
          <AlertTitle>Fullscreen unavailable</AlertTitle>
          <AlertDescription>
            Presentation continues in this window. Press Escape to exit.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex min-h-0 flex-1 items-center justify-center p-4">
        {imageError ? (
          <div className="space-y-4 text-center" onClick={(event) => event.stopPropagation()}>
            <p>Could not render slide {slideNumber}.</p>
            <div className="flex justify-center gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  if (cacheRef.current) {
                    void loadSlideImage(slides, currentIndex, cacheRef.current)
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
          <img
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

      <p
        className="pointer-events-none absolute bottom-4 left-4 text-sm text-white/70"
        aria-live="polite"
      >
        Slide {slideNumber} of {slides.length}
      </p>
    </div>
  )
}
