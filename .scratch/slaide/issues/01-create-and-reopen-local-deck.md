# 01 — Create and reopen a local Deck

**What to build:** A home-to-editor workflow where a user creates a local Deck with one blank Slide, opens it, and can reload its editor route without losing the Deck.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] The home screen lists locally stored Decks.
- [ ] Creating a Deck assigns a stable ID, uses the title `Untitled deck`, and creates one blank Slide.
- [ ] The Deck and Slide are committed atomically and satisfy the domain invariants.
- [ ] Creating or opening a Deck navigates to its editor route.
- [ ] Reloading the editor route reopens the same local Deck and Slide.
- [ ] A missing or corrupt Deck shows a recoverable error with a Return home action.
- [ ] No replacement Deck is created after a load failure.
- [ ] Automated coverage exercises the workflow through the browser and the storage transaction through the repository seam.
