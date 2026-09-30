import { Suspense, lazy, useEffect, useState, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import {
  DeckRepositoryProvider,
} from './storage/deck-repository-context.tsx'
import { createDeckRepository, type DeckRepository } from './storage/deck-repository.ts'
import { HomePage } from './ui/HomePage.tsx'
import { ThemeProvider } from './ui/ThemeProvider.tsx'
import { AppUpdatePrompt } from './pwa/AppUpdatePrompt.tsx'
import { ViewportGate } from './ui/ViewportGate.tsx'

const EditorPage = lazy(async () => {
  const module = await import('./ui/EditorPage.tsx')
  return { default: module.EditorPage }
})

const PresentationPage = lazy(async () => {
  const module = await import('./ui/PresentationPage.tsx')
  return { default: module.PresentationPage }
})

const PresenterPage = lazy(async () => {
  const module = await import('./ui/PresenterPage.tsx')
  return { default: module.PresenterPage }
})

function RouteFallback() {
  return (
    <main className="p-6">
      <p className="text-muted-foreground">Loading…</p>
    </main>
  )
}

function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/decks/:deckId/present/notes" element={<PresenterPage />} />
        <Route path="/decks/:deckId/present" element={<PresentationPage />} />
        <Route path="/decks/:deckId" element={<EditorPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

function RepositoryGate({ children }: { children: ReactNode }) {
  const [repository, setRepository] = useState<DeckRepository | null>(null)

  useEffect(() => {
    let cancelled = false
    void createDeckRepository().then((created) => {
      if (cancelled) {
        void created.dispose()
        return
      }
      setRepository(created)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!repository) {
    return (
      <main className="p-6">
        <p className="text-muted-foreground">Starting 💅…</p>
      </main>
    )
  }

  return <DeckRepositoryProvider repository={repository}>{children}</DeckRepositoryProvider>
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <ViewportGate>
          <RepositoryGate>
            <AppRoutes />
            <AppUpdatePrompt />
          </RepositoryGate>
        </ViewportGate>
      </ThemeProvider>
    </BrowserRouter>
  )
}

export default App
