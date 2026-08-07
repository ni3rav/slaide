# 11 — Import a Slaide file atomically

**What to build:** A user can import a complete `.slaide` backup from the home screen without overwriting local data or leaving partial records after invalid input or storage failure.

**Blocked by:** 04 — Constrain the fixed Slide; 10 — Export one Deck as a Slaide file

**Status:** resolved

- [x] The home screen accepts one `.slaide` file up to 100 MB.
- [x] The complete file is validated before any storage write.
- [x] Validation covers format version, required data, ownership, Slide order, binary files, and element boundaries.
- [x] Malformed, unsupported, oversized, and out-of-bounds files fail with a clear error.
- [x] Import generates a new Deck ID and new Slide IDs.
- [x] Imported Slide order and Scene relationships use the remapped IDs.
- [x] Existing Decks are never overwritten.
- [x] A matching local title gains the suffix ` (Imported)`.
- [x] All imported records commit in one transaction, and failure leaves storage unchanged.
- [x] A storage-quota failure is reported clearly.
- [x] Export-then-import round trips preserve complete Scene content while changing identities.
- [x] Pure, repository, and browser tests cover valid files, every rejection class, conflict behavior, rollback, and round trips.

## Answer

Implemented atomic `.slaide` import from the home screen:

- **Pure layer** (`src/slaide-file/import.ts`, `import-deck.ts`): parse JSON, enforce the 100 MB limit, validate format version, deck/slide ownership, slide order, binary file references, forbidden element types, and slide bounds via `allElementsInsideSlide`; remap to new deck/slide IDs and suffix conflicting titles with ` (Imported)`.
- **Repository** (`importDeck`): single IndexedDB transaction; rejects overwrite when a deck ID already exists; rolls back on abort; surfaces quota failures clearly.
- **Home UI**: Import deck button, hidden file input (`.slaide`), and inline error alert.
- **Tests**: browser tests for validation/remap; repository tests for commit, overwrite guard, rollback, and quota; e2e for valid import, title conflict, rejections, and export→import round trip (Chromium + Firefox).
