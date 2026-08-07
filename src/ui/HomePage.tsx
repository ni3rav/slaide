import { useEffect, useId, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useDeckRepository } from '../storage/deck-repository-context.tsx'
import type { DeckSummary } from '../storage/deck-repository.ts'

type DialogState =
  | { type: 'none' }
  | { type: 'rename'; deck: DeckSummary; title: string }
  | { type: 'delete'; deck: DeckSummary }

export function HomePage() {
  const repository = useDeckRepository()
  const navigate = useNavigate()
  const [decks, setDecks] = useState<DeckSummary[] | null>(null)
  const [creating, setCreating] = useState(false)
  const [dialog, setDialog] = useState<DialogState>({ type: 'none' })
  const [busy, setBusy] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleInputId = useId()

  useEffect(() => {
    let cancelled = false
    void repository.listDecks().then((listed) => {
      if (!cancelled) setDecks(listed)
    })
    return () => {
      cancelled = true
    }
  }, [repository])

  useEffect(() => {
    const element = dialogRef.current
    if (!element) return
    if (dialog.type === 'none') {
      if (element.open) element.close()
      return
    }
    if (!element.open) element.showModal()
  }, [dialog])

  async function refreshDecks() {
    setDecks(await repository.listDecks())
  }

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

  async function handleRenameSave() {
    if (dialog.type !== 'rename' || busy) return
    setBusy(true)
    try {
      await repository.renameDeck(dialog.deck.id, dialog.title)
      setDialog({ type: 'none' })
      await refreshDecks()
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteConfirm() {
    if (dialog.type !== 'delete' || busy) return
    setBusy(true)
    try {
      await repository.deleteDeck(dialog.deck.id)
      setDialog({ type: 'none' })
      await refreshDecks()
    } finally {
      setBusy(false)
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
              <p>{formatSlideCount(deck.slideCount)}</p>
              <time dateTime={new Date(deck.updatedAt).toISOString()}>
                {formatModifiedTime(deck.updatedAt)}
              </time>
              <button
                type="button"
                onClick={() =>
                  setDialog({ type: 'rename', deck, title: deck.title })
                }
              >
                Rename {deck.title}
              </button>
              <button
                type="button"
                onClick={() => setDialog({ type: 'delete', deck })}
              >
                Delete {deck.title}
              </button>
            </li>
          ))}
        </ul>
      )}

      <dialog
        ref={dialogRef}
        onClose={() => setDialog({ type: 'none' })}
        onCancel={(event) => {
          event.preventDefault()
          setDialog({ type: 'none' })
        }}
      >
        {dialog.type === 'rename' ? (
          <>
            <h2>Rename deck</h2>
            <label htmlFor={titleInputId}>Deck title</label>
            <input
              id={titleInputId}
              value={dialog.title}
              onChange={(event) =>
                setDialog({ ...dialog, title: event.target.value })
              }
            />
            <button type="button" onClick={() => setDialog({ type: 'none' })}>
              Cancel
            </button>
            <button type="button" onClick={() => void handleRenameSave()} disabled={busy}>
              Save
            </button>
          </>
        ) : null}
        {dialog.type === 'delete' ? (
          <>
            <h2>Delete “{dialog.deck.title}”</h2>
            <p>
              This permanently deletes {dialog.deck.title} and its{' '}
              {formatSlideCount(dialog.deck.slideCount)}.
            </p>
            <button type="button" onClick={() => setDialog({ type: 'none' })}>
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleDeleteConfirm()}
              disabled={busy}
            >
              Delete deck
            </button>
          </>
        ) : null}
      </dialog>
    </main>
  )
}

function formatSlideCount(slideCount: number): string {
  return slideCount === 1 ? '1 slide' : `${slideCount} slides`
}

function formatModifiedTime(updatedAt: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(updatedAt))
}
