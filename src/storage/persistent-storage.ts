let requested = false

/**
 * Requests persistent browser storage once after the first deck is created or imported.
 * Denial or errors do not throw; editing continues with best-effort storage.
 */
export async function requestPersistentStorageAfterFirstDeck(): Promise<void> {
  if (requested) return
  requested = true

  if (!navigator.storage?.persist) return

  try {
    await navigator.storage.persist()
  } catch {
    // Permission policy or browser support must not block deck workflows.
  }
}

/** Test-only reset for unit tests. */
export function resetPersistentStorageRequestForTests(): void {
  requested = false
}
