import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import {
  Excalidraw,
  MainMenu,
  convertToExcalidrawElements,
} from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import { useDeckRepository } from '../storage/deck-repository-context.tsx'
import type { Deck, Slide } from '../storage/deck-repository.ts'
import { toPersistentScene } from '../scene/persistent-scene.ts'
import {
  createSceneAutosave,
  type SaveStatus,
} from '../scene/scene-autosave.ts'
import './editor.css'

type EditorState =
  | { status: 'loading' }
  | { status: 'ok'; deck: Deck; slides: Slide[]; activeSlide: Slide }
  | { status: 'unavailable'; reason: 'missing' | 'corrupt' }

type SlaideTestApi = {
  addRectangle: () => void
}

declare global {
  interface Window {
    __slaideTest?: SlaideTestApi
  }
}

export function EditorPage() {
  const { deckId } = useParams<{ deckId: string }>()
  const repository = useDeckRepository()
  const navigate = useNavigate()
  const [state, setState] = useState<EditorState>({ status: 'loading' })
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [leaveWarning, setLeaveWarning] = useState(false)
  const autosaveRef = useRef<ReturnType<typeof createSceneAutosave> | null>(null)

  useEffect(() => {
    if (!deckId) {
      setState({ status: 'unavailable', reason: 'missing' })
      return
    }

    let cancelled = false
    setState({ status: 'loading' })
    void repository.loadDeck(deckId).then((result) => {
      if (cancelled) return
      if (result.status === 'ok') {
        const activeSlide = result.slides[0]
        if (!activeSlide) {
          setState({ status: 'unavailable', reason: 'corrupt' })
          return
        }
        setState({
          status: 'ok',
          deck: result.deck,
          slides: result.slides,
          activeSlide,
        })
        return
      }
      setState({ status: 'unavailable', reason: result.status })
    })

    return () => {
      cancelled = true
    }
  }, [deckId, repository])

  useEffect(() => {
    if (state.status !== 'ok') return

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
      delete window.__slaideTest
      void autosave
        .flush()
        .catch(() => undefined)
        .finally(() => autosave.dispose())
    }
  }, [repository, state])

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

  if (state.status === 'loading') {
    return (
      <main>
        <p>Loading deck…</p>
      </main>
    )
  }

  if (state.status === 'unavailable') {
    return (
      <main>
        <h1>Deck unavailable</h1>
        <p>This deck could not be opened.</p>
        <Link to="/">Return home</Link>
      </main>
    )
  }

  const initialScene = state.activeSlide.scene

  return (
    <main className="editor-page">
      <header className="editor-chrome">
        <h1>{state.deck.title}</h1>
        <p>
          Slide {1} of {state.slides.length}
        </p>
        <p role="status" aria-live="polite">
          {formatSaveStatus(saveStatus)}
        </p>
        <Link to="/" onClick={(event) => void handleHomeClick(event)}>
          Home
        </Link>
        {leaveWarning ? (
          <div role="alertdialog" aria-labelledby="leave-warning-title">
            <h2 id="leave-warning-title">Save failed</h2>
            <p>Your latest changes could not be saved. Leave anyway?</p>
            <button type="button" onClick={() => setLeaveWarning(false)}>
              Stay
            </button>
            <button type="button" onClick={() => navigate('/')}>
              Leave without saving
            </button>
          </div>
        ) : null}
      </header>
      <div className="editor-canvas" data-testid="excalidraw-host">
        <Excalidraw
          key={state.activeSlide.id}
          initialData={{
            elements: initialScene.elements as never[],
            appState: {
              ...initialScene.appState,
              showWelcomeScreen: false,
            },
            files: initialScene.files as never,
          }}
          UIOptions={{
            canvasActions: {
              loadScene: false,
              saveToActiveFile: false,
              export: false,
              saveAsImage: false,
              clearCanvas: true,
              changeViewBackgroundColor: true,
              toggleTheme: true,
            },
            tools: {
              image: true,
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
            }
          }}
          onChange={(elements, appState, files) => {
            const scene = toPersistentScene(
              elements,
              appState as unknown as Record<string, unknown>,
              files as unknown as Record<string, unknown>,
            )
            autosaveRef.current?.schedule(scene)
          }}
        >
          <MainMenu>
            <MainMenu.DefaultItems.ClearCanvas />
            <MainMenu.DefaultItems.ToggleTheme />
            <MainMenu.DefaultItems.ChangeCanvasBackground />
          </MainMenu>
        </Excalidraw>
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
