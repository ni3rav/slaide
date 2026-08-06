# 05 — Add and navigate independent Slides

**What to build:** A user can add Slides and navigate the numbered Slide order while each Slide retains an independent Scene and only one editor instance remains live.

**Blocked by:** 03 — Draw and autosave one Scene

**Status:** ready-for-agent

- [ ] The sidebar shows one numbered row for every Slide in Slide order.
- [ ] The Add slide action inserts one blank Slide immediately after the Active slide.
- [ ] The new Slide becomes active.
- [ ] Clicking a Slide row force-saves the current Scene before navigation.
- [ ] Navigation unmounts the current Excalidraw instance and mounts the target Scene in a new instance.
- [ ] At most one Excalidraw instance is live at every point in the workflow.
- [ ] Returning to a Slide restores its Scene and fits its frame.
- [ ] Undo and redo history may reset after Slide navigation.
- [ ] Slide creation and Slide order updates are transactional.
- [ ] Browser and repository tests cover insertion positions, independent content, forced saves, reloads, and the single-instance invariant.
