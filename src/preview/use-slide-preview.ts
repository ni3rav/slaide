import { useCallback, useEffect, useRef, useState } from 'react'
import {
  renderSlideToPngBlob,
  type SlideRenderTheme,
} from '../presentation/slide-to-png.ts'
import type { Scene, Slide, SlideId } from '../storage/deck-repository.ts'
import {
  createSlidePreviewController,
  type SlidePreviewController,
  type SlidePreviewRender,
} from './slide-preview-controller.ts'
import type { SlidePreviewPanelState } from './SlidePreviewPanel.tsx'

// #region agent log
function agentDebugLog(
  hypothesisId: string,
  location: string,
  message: string,
  data: Record<string, unknown>,
) {
  void fetch('/__agent-debug-log', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ hypothesisId, location, message, data, timestamp: Date.now() }),
  })
}
// #endregion

export type SlidePreviewSession = {
  slideId: SlideId
  panelState: SlidePreviewPanelState
  imageUrl: string | null
}

export type SlidePreviewTestApi = {
  getActiveObjectUrlCount: () => number
  failNextRender: () => void
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
      controllerRef.current?.revoke()
      // #region agent log
      agentDebugLog('B,C', 'use-slide-preview.ts:startLoad', 'Preview load started', {
        slideId: slide.id,
        isActive,
        generation,
      })
      // #endregion
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

        // #region agent log
        agentDebugLog('C,D', 'use-slide-preview.ts:startLoad', 'Preview render completed', {
          slideId: slide.id,
          generation,
          activeUrlCount: controllerRef.current?.getActiveUrlCount() ?? 0,
        })
        // #endregion
        setSession({
          slideId: slide.id,
          panelState: 'ready',
          imageUrl,
        })
      } catch (error) {
        // #region agent log
        agentDebugLog('C,D', 'use-slide-preview.ts:startLoad', 'Preview load failed', {
          slideId: slide.id,
          generation,
          errorName: error instanceof Error ? error.name : typeof error,
          errorMessage: error instanceof Error ? error.message : String(error),
        })
        // #endregion
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

  const clearPreview = useCallback(() => {
    loadGenerationRef.current += 1
    controllerRef.current?.revoke()
    setSession(null)
  }, [])

  const openPreview = useCallback(
    (slide: Slide, isActive: boolean) => {
      // #region agent log
      agentDebugLog('A,B', 'use-slide-preview.ts:openPreview', 'Preview toggle invoked', {
        slideId: slide.id,
        isActive,
        currentSlideId: session?.slideId ?? null,
        action: session?.slideId === slide.id ? 'close' : 'open',
      })
      // #endregion
      if (session?.slideId === slide.id) {
        clearPreview()
        return
      }

      void startLoad(slide, isActive)
    },
    [clearPreview, session?.slideId, startLoad],
  )

  const retryPreview = useCallback(
    (slide: Slide, isActive: boolean) => {
      void startLoad(slide, isActive)
    },
    [startLoad],
  )

  useEffect(() => {
    window.__slaidePreviewTest = {
      getActiveObjectUrlCount: () => controllerRef.current?.getActiveUrlCount() ?? 0,
      failNextRender: () => {
        failNextRenderRef.current = true
      },
    }

    return () => {
      delete window.__slaidePreviewTest
    }
  }, [])

  useEffect(() => {
    return () => {
      loadGenerationRef.current += 1
      controllerRef.current?.revoke()
    }
  }, [])

  return {
    session,
    openPreview,
    clearPreview,
    retryPreview,
  }
}

declare global {
  interface Window {
    __slaidePreviewTest?: SlidePreviewTestApi
  }
}
