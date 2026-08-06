# 07 — Select, duplicate, and swap Slides

**What to build:** Checkbox selection exposes predictable batch actions for duplicating complete Slides, deleting selections, and swapping exactly two positions.

**Blocked by:** 05 — Add and navigate independent Slides; 06 — Delete Slides safely

**Status:** ready-for-agent

- [ ] Each Slide row has a checkbox that does not trigger row navigation.
- [ ] Selecting one or more Slides shows Delete, Duplicate, and Swap actions.
- [ ] Swap is enabled only when exactly two Slides are checked.
- [ ] Duplicate copies each selected Scene and its binary files with new IDs.
- [ ] Every copy is inserted directly after its source while source order is preserved.
- [ ] Swap exchanges only the two selected positions.
- [ ] Checked state persists through Slide navigation.
- [ ] Checked state clears after Delete, Duplicate, or Swap and after opening another Deck.
- [ ] Each multi-record action is transactional and updates the Deck's last-modified time.
- [ ] Pure and browser tests cover nonadjacent selections, multiple duplicates, Swap eligibility, order results, and selection cleanup.
