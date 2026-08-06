import { createContext, useContext, type ReactNode } from 'react'
import type { DeckRepository } from '../storage/deck-repository.ts'

const DeckRepositoryContext = createContext<DeckRepository | null>(null)

export function DeckRepositoryProvider({
  repository,
  children,
}: {
  repository: DeckRepository
  children: ReactNode
}) {
  return (
    <DeckRepositoryContext.Provider value={repository}>
      {children}
    </DeckRepositoryContext.Provider>
  )
}

export function useDeckRepository(): DeckRepository {
  const repository = useContext(DeckRepositoryContext)
  if (!repository) {
    throw new Error('DeckRepositoryProvider is required')
  }
  return repository
}
