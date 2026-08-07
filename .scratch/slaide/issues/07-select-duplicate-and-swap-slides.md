# 07 — Select, duplicate, and swap Slides

**What to build:** Checkbox selection exposes predictable batch actions for duplicating complete Slides, deleting selections, and swapping exactly two positions.

**Blocked by:** 05 — Add and navigate independent Slides; 06 — Delete Slides safely

**Status:** resolved

- [x] Each Slide row has a checkbox that does not trigger row navigation.
- [x] Selecting one or more Slides shows Delete, Duplicate, and Swap actions.
- [x] Swap is enabled only when exactly two Slides are checked.
- [x] Duplicate copies each selected Scene and its binary files with new IDs.
- [x] Every copy is inserted directly after its source while source order is preserved.
- [x] Swap exchanges only the two selected positions.
- [x] Checked state persists through Slide navigation.
- [x] Checked state clears after Delete, Duplicate, or Swap and after opening another Deck.
- [x] Each multi-record action is transactional and updates the Deck's last-modified time.
- [x] Pure and browser tests cover nonadjacent selections, multiple duplicates, Swap eligibility, order results, and selection cleanup.

## Answer

Added `planSlideDuplication` and `planSlideSwap` pure domain helpers (`src/slide/slide-duplication.ts`, `src/slide/slide-swap.ts`) for insert-after-source duplication order and two-position exchange. Added transactional `duplicateSlides` and `swapSlides` on the deck repository: duplicate deep-copies scenes (including files) with new slide IDs and updates slide order; swap updates slide order only. Editor sidebar now shows Duplicate and Swap icon buttons alongside Delete when slides are checked; Swap disables unless exactly two are selected; selection clears after batch actions and when `deckId` changes. Covered by five domain tests, seven repository tests (including transaction rollback), and seven Playwright tests in Chromium and Firefox.
