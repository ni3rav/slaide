# 14 — Prevent concurrent Deck editing

**What to build:** Opening the same Deck in multiple browser contexts cannot cause competing writes; one context edits while others clearly remain read-only.

**Blocked by:** 03 — Draw and autosave one Scene

**Status:** resolved

- [x] Opening a Deck for editing acquires a lock scoped to that Deck.
- [x] Another browser context cannot acquire the same Deck lock concurrently.
- [x] A context without the lock opens the Deck in read-only mode.
- [x] Read-only mode explains that the Deck is open elsewhere.
- [x] Read-only mode prevents Scene and Deck mutations without hiding stored content.
- [x] Closing or leaving the editing context releases its lock.
- [x] A waiting context can become editable after the lock is released and data is refreshed.
- [x] Different Decks can be edited in separate contexts simultaneously.
- [x] Browser integration tests cover contention, release, takeover, stale-content refresh, and independent Decks.

## Answer

Uses the Web Locks API (`navigator.locks`) with per-deck exclusive lock names (`slaide-deck-{id}`), wrapped in `deck-lock.ts` and a React Strict Mode–safe `deck-edit-session.ts` (serialized open, session IDs, deferred release). `EditorPage` acquires the lock on open, shows a read-only banner and Excalidraw `viewModeEnabled` when blocked, skips autosave/mutation hooks, waits for lock release via `waitForDeckEditLock`, reloads deck data, then promotes to editable. Playwright tests in `e2e/prevent-concurrent-deck-editing.spec.ts` cover contention, release/takeover, stale refresh, read-only non-persistence, and independent decks on Chromium and Firefox.
