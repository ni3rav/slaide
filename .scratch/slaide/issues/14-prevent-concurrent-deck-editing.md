# 14 — Prevent concurrent Deck editing

**What to build:** Opening the same Deck in multiple browser contexts cannot cause competing writes; one context edits while others clearly remain read-only.

**Blocked by:** 03 — Draw and autosave one Scene

**Status:** ready-for-agent

- [ ] Opening a Deck for editing acquires a lock scoped to that Deck.
- [ ] Another browser context cannot acquire the same Deck lock concurrently.
- [ ] A context without the lock opens the Deck in read-only mode.
- [ ] Read-only mode explains that the Deck is open elsewhere.
- [ ] Read-only mode prevents Scene and Deck mutations without hiding stored content.
- [ ] Closing or leaving the editing context releases its lock.
- [ ] A waiting context can become editable after the lock is released and data is refreshed.
- [ ] Different Decks can be edited in separate contexts simultaneously.
- [ ] Browser integration tests cover contention, release, takeover, stale-content refresh, and independent Decks.
