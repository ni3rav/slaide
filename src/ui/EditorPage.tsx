import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useDeckRepository } from '../storage/deck-repository-context.tsx'
import type { Deck, Slide } from '../storage/deck-repository.ts'

type EditorState =
  | { status: 'loading' }
  | { status: 'ok'; deck: Deck; slides: Slide[] }
  | { status: 'unavailable'; reason: 'missing' | 'corrupt' }

export function EditorPage() {
  const { deckId } = useParams<{ deckId: string }>()
  const repository = useDeckRepository()
  const [state, setState] = useState<EditorState>({ status: 'loading' })

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
        setState({ status: 'ok', deck: result.deck, slides: result.slides })
        return
      }
      setState({ status: 'unavailable', reason: result.status })
    })

    return () => {
      cancelled = true
    }
  }, [deckId, repository])

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

  return (
    <main>
      <h1>{state.deck.title}</h1>
      <p>
        Slide {1} of {state.slides.length}
      </p>
      <Link to="/">Home</Link>
    </main>
  )
}
