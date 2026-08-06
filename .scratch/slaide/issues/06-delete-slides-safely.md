# 06 — Delete Slides safely

**What to build:** A user can delete one or more selected Slides without breaking the Deck or losing track of the next Active slide.

**Blocked by:** 05 — Add and navigate independent Slides

**Status:** ready-for-agent

- [ ] Delete removes every checked Slide and its Scene records.
- [ ] Delete removes the corresponding IDs from Slide order.
- [ ] If the Active slide is deleted, the Slide at its previous position becomes active.
- [ ] If no Slide follows that position, the preceding Slide becomes active.
- [ ] Deleting every Slide creates and activates one new blank Slide.
- [ ] The Deck always has at least one Slide after a successful operation.
- [ ] Slide deletion, blank replacement, and order changes commit in one transaction.
- [ ] A failed transaction preserves the original Deck and Slides.
- [ ] Pure, repository, and browser tests cover all active-position and delete-all cases.
