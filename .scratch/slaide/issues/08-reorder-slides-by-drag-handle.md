# 08 — Reorder Slides by drag handle

**What to build:** A user can move one Slide to an exact insertion point with a dedicated drag handle without interfering with row navigation, preview, or checkbox selection.

**Blocked by:** 05 — Add and navigate independent Slides

**Status:** ready-for-agent

- [ ] Drag reorder uses `dnd-kit` and not the native HTML Drag and Drop API.
- [ ] A drag starts only from the Slide row's dedicated handle.
- [ ] Row, checkbox, and preview interactions do not start a drag.
- [ ] The sidebar shows an exact insertion indicator between rows.
- [ ] Drop removes the dragged Slide ID from its old position and inserts it at the indicated position.
- [ ] Drop does not swap with the target row.
- [ ] Only one Slide moves, regardless of checked state.
- [ ] Checked state is unchanged after reorder.
- [ ] Reorder is keyboard-operable through the drag handle.
- [ ] The order change commits transactionally and survives reload.
- [ ] Pure and browser tests cover upward, downward, boundary, no-op, keyboard, and selected-Slide moves.
