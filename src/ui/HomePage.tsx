import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useDeckRepository } from '../storage/deck-repository-context.tsx'
import type { DeckSummary } from '../storage/deck-repository.ts'

export function HomePage() {
  const repository = useDeckRepository()
  const navigate = useNavigate()
  const [decks, setDecks] = useState<DeckSummary[] | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    let cancelled = false
    void repository.listDecks().then((listed) => {
      if (!cancelled) setDecks(listed)
    })
    return () => {
      cancelled = true
    }
  }, [repository])

  async function handleCreateDeck() {
    if (creating) return
    setCreating(true)
    try {
      const created = await repository.createDeck()
      navigate(`/decks/${created.deck.id}`)
    } finally {
      setCreating(false)
    }
  }

  return (
    <main>
      <h1>Slaide</h1>
      <button type="button" onClick={() => void handleCreateDeck()} disabled={creating}>
        New deck
      </button>
      {decks === null ? (
        <p>Loading decks…</p>
      ) : decks.length === 0 ? (
        <p>No decks yet</p>
      ) : (
        <ul>
          {decks.map((deck) => (
            <li key={deck.id}>
              <Link to={`/decks/${deck.id}`}>{deck.title}</Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
