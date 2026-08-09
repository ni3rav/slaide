import { useCallback, useEffect, useRef, useState } from 'react'
import {
  renderSlideToPngBlob,
  type SlideRenderTheme,
} from '../presentation/slide-to-png.ts'
import type { Scene, Slide, SlideId } from '../storage/deck-repository.ts'
import { PREVIEW_CLOSE_DURATION_MS } from './constants.ts'
import {
  createSlidePreviewController,
  type SlidePreviewController,
  type SlidePreviewRender,
} from './slide-preview-controller.ts'
import type { SlidePreviewPanelState } from './SlidePreviewPanel.tsx'

export type SlidePreviewSession = {
  slideId: SlideId
  panelState: SlidePreviewPanelState
  imageUrl: string | null
}

export type SlidePreviewTestApi = {
  getActiveObjectUrlCount: () => number
  isPreviewAnimating: () => boolean
  failNextRender: () => void
}

type PendingPreview = {
  slide: Slide
  isActive: boolean
}

type UseSlidePreviewOptions = {
  resolveScene: (slide: Slide, isActive: boolean) => Promise<Scene>
  render?: SlidePreviewRender
  theme?: SlideRenderTheme
}

export function useSlidePreview({ resolveScene, render, theme }: UseSlidePreviewOptions) {
  const controllerRef = useRef<SlidePreviewController | null>(null)
  const failNextRenderRef = useRef(false)
  const loadGenerationRef = useRef(0)
  const pendingOpenRef = useRef<PendingPreview | null>(null)
  const themeRef = useRef<SlideRenderTheme>(theme ?? 'light')
  const [session, setSession] = useState<SlidePreviewSession | null>(null)

  useEffect(() => {
    themeRef.current = theme ?? 'light'
  }, [theme])

  if (!controllerRef.current) {
    controllerRef.current = createSlidePreviewController(async (scene) => {
      if (failNextRenderRef.current) {
        failNextRenderRef.current = false
        throw new Error('Preview render failed')
      }
      return render ? render(scene) : renderSlideToPngBlob(scene, themeRef.current)
    })
  }

  const startLoad = useCallback(
    async (slide: Slide, isActive: boolean) => {
      const generation = loadGenerationRef.current + 1
      loadGenerationRef.current = generation
      setSession({
        slideId: slide.id,
        panelState: 'loading',
        imageUrl: null,
      })

      try {
        const scene = await resolveScene(slide, isActive)
        if (generation !== loadGenerationRef.current) return

        const imageUrl = await controllerRef.current!.load(scene)
        if (generation !== loadGenerationRef.current) return

        setSession({
          slideId: slide.id,
          panelState: 'ready',
          imageUrl,
        })
      } catch {
        if (generation !== loadGenerationRef.current) return
        setSession({
          slideId: slide.id,
          panelState: 'error',
          imageUrl: null,
        })
      }
    },
    [resolveScene],
  )

  const openPreview = useCallback(
    (slide: Slide, isActive: boolean) => {
      if (session?.slideId === slide.id && session.panelState !== 'closing') {
        loadGenerationRef.current += 1
        setSession({
          slideId: session.slideId,
          panelState: 'closing',
          imageUrl: session.imageUrl,
        })
        return
      }

      if (session && session.slideId !== slide.id && session.panelState !== 'closing') {
        pendingOpenRef.current = { slide, isActive }
        loadGenerationRef.current += 1
        setSession({
          slideId: session.slideId,
          panelState: 'closing',
          imageUrl: session.imageUrl,
        })
        return
      }

      void startLoad(slide, isActive)
    },
    [session, startLoad],
  )

  const handleCloseComplete = useCallback(() => {
    controllerRef.current?.revoke()
    const pending = pendingOpenRef.current
    pendingOpenRef.current = null

    if (pending) {
      void startLoad(pending.slide, pending.isActive)
      return
    }

    setSession(null)
  }, [startLoad])

  const retryPreview = useCallback(
    (slide: Slide, isActive: boolean) => {
      controllerRef.current?.revoke()
      loadGenerationRef.current += 1
      void startLoad(slide, isActive)
    },
    [startLoad],
  )

  useEffect(() => {
    window.__slaidePreviewTest = {
      getActiveObjectUrlCount: () => controllerRef.current?.getActiveUrlCount() ?? 0,
      isPreviewAnimating: () => session?.panelState === 'closing',
      failNextRender: () => {
        failNextRenderRef.current = true
      },
    }

    return () => {
      delete window.__slaidePreviewTest
    }
  }, [session?.panelState])

  useEffect(() => {
    return () => {
      controllerRef.current?.revoke()
    }
  }, [])

  return {
    session,
    openPreview,
    handleCloseComplete,
    retryPreview,
    closeDurationMs: PREVIEW_CLOSE_DURATION_MS,
  }
}

declare global {
  interface Window {
    __slaidePreviewTest?: SlidePreviewTestApi
  }
}
