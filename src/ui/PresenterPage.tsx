import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { useDeckRepository } from '../storage/deck-repository-context.tsx'
import type { Slide } from '../storage/deck-repository.ts'
import { readPresenterNotes } from '../slide/presenter-notes.ts'
import {
  createPresentationImageCache,
  type PresentationImageCache,
} from '../presentation/presentation-image-cache.ts'
import { renderSlideToPngBlob } from '../presentation/slide-to-png.ts'
import { canAcceptPresentationNavigation } from '../presentation/presentation-navigation-throttle.ts'
import { usePresenterSync, type PresenterSyncApi } from '../presentation/use-presenter-sync.ts'
import { useTheme } from './ThemeProvider.tsx'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

type PresenterState =
  | { status: 'loading' }
  | { status: 'unavailable' }
  | { status: 'ended' }
  | {
      status: 'ready'
      slides: Slide[]
      currentIndex: number
      currentUrl: string | null
      nextUrl: string | null
      imageError: boolean
    }

function parseStartIndex(value: string | null, slideCount: number): number {
  if (!value) return 0
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 0) return 0
  if (parsed >= slideCount) return Math.max(0, slideCount - 1)
  return parsed
}

export function PresenterPage() {
  const { deckId } = useParams<{ deckId: string }>()
  const [searchParams] = useSearchParams()
  const repository = useDeckRepository()
  const { theme } = useTheme()
  const themeRef = useRef(theme)
  const cacheRef = useRef<PresentationImageCache | null>(null)
  const requestRef = useRef(0)
  const lastNavigationAtRef = useRef<number | null>(null)
  const pendingGoRef = useRef<number | null>(null)
  const [state, setState] = useState<PresenterState>({ status: 'loading' })

  useEffect(() => {
    themeRef.current = theme
  }, [theme])

  const loadImages = useCallback(async (slides: Slide[], index: number) => {
    const cache = cacheRef.current
    const slide = slides[index]
    if (!cache || !slide) return

    const request = ++requestRef.current
    cache.ensureWindow(slides, index)

    try {
      const currentUrl = await cache.getObjectUrl(slide.id, slide.scene)
      const next = slides[index + 1]
      const nextUrl = next ? await cache.getObjectUrl(next.id, next.scene) : null
      if (request !== requestRef.current) return

      setState((previous) =>
        previous.status === 'ready' && previous.currentIndex === index
          ? { ...previous, currentUrl, nextUrl, imageError: false }
          : previous,
      )
    } catch {
      if (request !== requestRef.current) return
      setState((previous) =>
        previous.status === 'ready' && previous.currentIndex === index
          ? { ...previous, currentUrl: null, nextUrl: null, imageError: true }
          : previous,
      )
    }
  }, [])

  const applyIndex = useCallback(
    (nextIndex: number) => {
      setState((previous) => {
        if (previous.status !== 'ready') return previous
        if (nextIndex < 0 || nextIndex >= previous.slides.length) return previous
        if (nextIndex === previous.currentIndex) return previous
        return {
          ...previous,
          currentIndex: nextIndex,
          currentUrl: null,
          nextUrl: null,
          imageError: false,
        }
      })
    },
    [],
  )

  const readySlides = state.status === 'ready' ? state.slides : null
  const readyIndex = state.status === 'ready' ? state.currentIndex : -1

  useEffect(() => {
    if (!readySlides || readyIndex < 0 || !cacheRef.current) return
    void loadImages(readySlides, readyIndex)
  }, [loadImages, readyIndex, readySlides])

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
      const result = await repository.loadDeck(deckId!)
      if (cancelled) return
      if (result.status !== 'ok' || result.slides.length === 0) {
        setState({ status: 'unavailable' })
        return
      }

      const startIndex = parseStartIndex(searchParams.get('start'), result.slides.length)
      setState({
        status: 'ready',
        slides: result.slides,
        currentIndex: startIndex,
        currentUrl: null,
        nextUrl: null,
        imageError: false,
      })
    }

    void start()

    return () => {
      cancelled = true
      requestRef.current += 1
      cache.revokeAll()
      cacheRef.current = null
    }
  }, [deckId, repository, searchParams])

  const endPresenterView = useCallback(() => {
    setState({ status: 'ended' })
    window.close()
  }, [])

  const indexRef = useRef(0)
  if (state.status === 'ready') indexRef.current = state.currentIndex
  const syncRef = useRef<PresenterSyncApi>({
    publishIndex: () => {},
    publishGo: () => {},
    publishExit: () => {},
  })

  const sync = usePresenterSync({
    deckId,
    role: 'presenter',
    enabled: state.status === 'ready',
    getIndex: () => (state.status === 'ready' ? indexRef.current : null),
    onIndex: (index) => {
      const pending = pendingGoRef.current
      if (pending != null && pending !== index) {
        pendingGoRef.current = null
        syncRef.current.publishGo(pending)
        return
      }
      pendingGoRef.current = null
      applyIndex(index)
    },
    onGo: () => {},
    onExit: endPresenterView,
  })
  syncRef.current = sync

  const goToSlide = useCallback(
    (nextIndex: number) => {
      if (state.status !== 'ready') return
      if (nextIndex < 0 || nextIndex >= state.slides.length || nextIndex === state.currentIndex) {
        return
      }

      const now = Date.now()
      if (!canAcceptPresentationNavigation(lastNavigationAtRef.current, now)) return
      lastNavigationAtRef.current = now

      pendingGoRef.current = nextIndex
      applyIndex(nextIndex)
      sync.publishGo(nextIndex)
    },
    [applyIndex, state, sync],
  )

  useEffect(() => {
    if (state.status !== 'ready') return

    function handleKeyDown(event: KeyboardEvent) {
      if (state.status !== 'ready') return
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        goToSlide(state.currentIndex + 1)
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        goToSlide(state.currentIndex - 1)
      } else if (event.key === 'Escape') {
        event.preventDefault()
        sync.publishExit()
        endPresenterView()
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [endPresenterView, goToSlide, state, sync])

  useEffect(() => {
    document.title = 'Presenter · Slaide'
  }, [])

  if (state.status === 'loading') {
    return (
      <main className="grid h-svh place-content-center bg-neutral-950 p-6 text-white">
        <p className="text-white/70">Preparing presenter view…</p>
      </main>
    )
  }

  if (state.status === 'unavailable') {
    return (
      <main className="grid h-svh place-content-center bg-neutral-950 p-6 text-center text-white">
        <h1 className="text-xl font-semibold">Presenter view unavailable</h1>
        <p className="mt-2 text-white/70">This deck could not be opened.</p>
      </main>
    )
  }

  if (state.status === 'ended') {
    return (
      <main className="grid h-svh place-content-center bg-neutral-950 p-6 text-center text-white">
        <h1 className="text-xl font-semibold">Presentation ended</h1>
        <p className="mt-2 text-white/70">You can close this window.</p>
      </main>
    )
  }

  const { slides, currentIndex, currentUrl, nextUrl, imageError } = state
  const notes = readPresenterNotes(slides[currentIndex]?.notes)
  const slideNumber = currentIndex + 1
  const hasNext = currentIndex < slides.length - 1

  return (
    <div
      className="flex h-svh flex-col bg-neutral-950 text-white"
      data-testid="presenter-view"
      role="application"
      aria-label="Presenter view"
    >
      <header className="flex shrink-0 items-center justify-between gap-3 px-4 py-3">
        <p className="text-sm text-white/80" data-testid="presenter-slide-counter">
          Slide {slideNumber} of {slides.length}
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="bg-white/10 text-white hover:bg-white/20 hover:text-white"
            aria-label="Previous slide"
            title="Previous slide"
            disabled={currentIndex === 0}
            onClick={() => goToSlide(currentIndex - 1)}
          >
            <ChevronLeft />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="bg-white/10 text-white hover:bg-white/20 hover:text-white"
            aria-label="Next slide"
            title="Next slide"
            disabled={!hasNext}
            onClick={() => goToSlide(currentIndex + 1)}
          >
            <ChevronRight />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-white/70 hover:bg-white/10 hover:text-white"
            aria-label="Exit presentation"
            title="Exit presentation"
            onClick={() => {
              sync.publishExit()
              endPresenterView()
            }}
          >
            <X />
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 px-4 pb-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(16rem,0.7fr)]">
        <div className="flex min-h-0 flex-col gap-3">
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg bg-black">
            {imageError ? (
              <div className="space-y-3 text-center">
                <p>Could not render slide {slideNumber}.</p>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void loadImages(slides, currentIndex)}
                >
                  Retry
                </Button>
              </div>
            ) : currentUrl ? (
              <img
                src={currentUrl}
                alt={`Slide ${slideNumber} of ${slides.length}`}
                className="max-h-full max-w-full object-contain"
                data-testid="presenter-current-slide"
                draggable={false}
              />
            ) : (
              <p className="text-white/60">Loading slide {slideNumber}…</p>
            )}
          </div>
          <div className="flex h-28 shrink-0 items-center gap-3 overflow-hidden rounded-lg bg-white/5 px-3">
            <p className="w-12 shrink-0 text-xs tracking-wide text-white/60 uppercase">Next</p>
            {hasNext && nextUrl ? (
              <img
                src={nextUrl}
                alt={`Next slide, slide ${slideNumber + 1}`}
                className="max-h-24 max-w-full object-contain"
                data-testid="presenter-next-slide"
                draggable={false}
              />
            ) : (
              <p className="text-sm text-white/60" data-testid="presenter-next-slide">
                {hasNext ? 'Loading next slide…' : 'End of deck'}
              </p>
            )}
          </div>
        </div>

        <section
          aria-label="Presenter notes"
          className="min-h-40 overflow-y-auto rounded-lg bg-white/5 p-4"
        >
          <h2 className="text-xs font-medium tracking-[0.08em] text-white/60 uppercase">Notes</h2>
          <p
            className="mt-3 text-lg leading-relaxed whitespace-pre-wrap text-white"
            data-testid="presenter-notes-text"
          >
            {notes || 'No notes for this slide.'}
          </p>
        </section>
      </div>
    </div>
  )
}
