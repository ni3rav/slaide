# 09 — Preview a Slide on demand

**What to build:** A user can inspect a temporary static Preview beneath a Slide row without navigating away or retaining generated images.

**Blocked by:** 05 — Add and navigate independent Slides

**Status:** ready-for-agent

- [ ] Each Slide row has a Preview control that does not trigger navigation.
- [ ] Activating Preview generates a PNG from the complete fixed Slide and its background.
- [ ] The Preview opens in an accordion beneath the selected row.
- [ ] Only one Preview accordion can be open.
- [ ] Opening another Preview closes the current one.
- [ ] Closing uses a visible closing animation.
- [ ] Closing or replacing a Preview revokes its object URL and releases the image.
- [ ] Preview images are never stored in IndexedDB.
- [ ] A rendering failure shows an inline Retry action.
- [ ] Browser tests verify rendering, one-open behavior, retry, animation completion, and object-URL cleanup.
