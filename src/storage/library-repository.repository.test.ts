import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { LibraryItems } from '@excalidraw/excalidraw/types'
import {
  createLibraryRepository,
  type LibraryRepository,
} from './library-repository.ts'

describe('LibraryRepository', () => {
  let databaseName: string
  let repository: LibraryRepository

  beforeEach(async () => {
    databaseName = `slaide-library-${crypto.randomUUID()}`
    repository = await createLibraryRepository({ databaseName })
  })

  afterEach(async () => {
    await repository.dispose()
    await deleteDatabase(databaseName)
  })

  it('returns an empty library when nothing is stored', async () => {
    expect(await repository.getLibraryItems()).toEqual([])
  })

  it('persists and reloads library items', async () => {
    const items = [
      {
        id: 'item-1',
        status: 'unpublished',
        created: 1,
        elements: [
          {
            id: 'el-1',
            type: 'rectangle',
            x: 0,
            y: 0,
            width: 100,
            height: 80,
            angle: 0,
            strokeColor: '#000000',
            backgroundColor: 'transparent',
            fillStyle: 'solid',
            strokeWidth: 1,
            strokeStyle: 'solid',
            roughness: 1,
            opacity: 100,
            groupIds: [],
            frameId: null,
            index: 'a0',
            roundness: null,
            seed: 1,
            version: 1,
            versionNonce: 1,
            isDeleted: false,
            boundElements: null,
            updated: 1,
            link: null,
            locked: false,
          },
        ],
      },
    ] as unknown as LibraryItems

    await repository.setLibraryItems(items)
    expect(await repository.getLibraryItems()).toEqual(items)

    await repository.setLibraryItems([])
    expect(await repository.getLibraryItems()).toEqual([])
  })
})

async function deleteDatabase(databaseName: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName)
    request.onsuccess = () => resolve()
    request.onerror = () =>
      reject(request.error ?? new Error('Failed to delete database'))
    request.onblocked = () => resolve()
  })
}
