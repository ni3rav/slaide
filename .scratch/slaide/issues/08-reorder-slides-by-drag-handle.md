# 08 — Reorder Slides by drag handle

**What to build:** A user can move one Slide to an exact insertion point with a dedicated drag handle without interfering with row navigation, preview, or checkbox selection.

**Blocked by:** 05 — Add and navigate independent Slides

**Status:** resolved

- [x] Drag reorder uses `dnd-kit` and not the native HTML Drag and Drop API.
- [x] A drag starts only from the Slide row's dedicated handle.
- [x] Row, checkbox, and preview interactions do not start a drag.
- [x] The sidebar shows an exact insertion indicator between rows.
- [x] Drop removes the dragged Slide ID from its old position and inserts it at the indicated position.
- [x] Drop does not swap with the target row.
- [x] Only one Slide moves, regardless of checked state.
- [x] Checked state is unchanged after reorder.
- [x] Reorder is keyboard-operable through the drag handle.
- [x] The order change commits transactionally and survives reload.
- [x] Pure and browser tests cover upward, downward, boundary, no-op, keyboard, and selected-Slide moves.

## Answer

Implemented insertion-based slide reorder as a pure `planSlideInsertion` helper, a transactional `reorderSlide` repository method, and sidebar `dnd-kit` wiring with handle-only activation, between-row insertion indicators, and ArrowUp/ArrowDown on the handle for keyboard moves. E2E specs cover drag directions, boundaries, no-op row drags, checked-state preservation, keyboard reorder, and persistence across reload.
