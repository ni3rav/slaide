# 06 — Delete Slides safely

**What to build:** A user can delete one or more selected Slides without breaking the Deck or losing track of the next Active slide.

**Blocked by:** 05 — Add and navigate independent Slides

**Status:** resolved

- [x] Delete removes every checked Slide and its Scene records.
- [x] Delete removes the corresponding IDs from Slide order.
- [x] If the Active slide is deleted, the Slide at its previous position becomes active.
- [x] If no Slide follows that position, the preceding Slide becomes active.
- [x] Deleting every Slide creates and activates one new blank Slide.
- [x] The Deck always has at least one Slide after a successful operation.
- [x] Slide deletion, blank replacement, and order changes commit in one transaction.
- [x] A failed transaction preserves the original Deck and Slides.
- [x] Pure, repository, and browser tests cover all active-position and delete-all cases.

## Answer

Added `planSlideDeletion` pure domain helper (`src/slide/slide-deletion.ts`) that computes the next slide order, deleted IDs, next active slide (scan following then preceding positions), and whether a blank replacement slide is required. Added transactional `deleteSlides` on the deck repository: deletes slide/scene records, updates slide order, creates a blank slide when every slide is removed, and returns the resolved active slide. Editor sidebar now has per-row checkboxes and a Delete action when one or more slides are checked; deletion force-flushes the active scene, clears selection, and remounts Excalidraw on the resolved active slide. Covered by seven domain tests, seven repository tests (including transaction rollback), and five Playwright tests in Chromium and Firefox.
