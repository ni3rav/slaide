# 01 — Create and reopen a local Deck

**What to build:** A home-to-editor workflow where a user creates a local Deck with one blank Slide, opens it, and can reload its editor route without losing the Deck.

**Blocked by:** None — can start immediately

**Status:** resolved

- [x] The home screen lists locally stored Decks.
- [x] Creating a Deck assigns a stable ID, uses the title `Untitled deck`, and creates one blank Slide.
- [x] The Deck and Slide are committed atomically and satisfy the domain invariants.
- [x] Creating or opening a Deck navigates to its editor route.
- [x] Reloading the editor route reopens the same local Deck and Slide.
- [x] A missing or corrupt Deck shows a recoverable error with a Return home action.
- [x] No replacement Deck is created after a load failure.
- [x] Automated coverage exercises the workflow through the browser and the storage transaction through the repository seam.

## Answer

Shipped the IndexedDB `DeckRepository` seam (atomic create, list, load with missing/corrupt results) and the home → `/decks/:deckId` editor workflow with reload + recoverable load errors. Covered by Vitest browser repository tests and Playwright Chromium/Firefox acceptance tests.
