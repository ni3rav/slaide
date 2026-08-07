# 09 — Preview a Slide on demand

**What to build:** A user can inspect a temporary static Preview beneath a Slide row without navigating away or retaining generated images.

**Blocked by:** 05 — Add and navigate independent Slides

**Status:** resolved

- [x] Each Slide row has a Preview control that does not trigger navigation.
- [x] Activating Preview generates a PNG from the complete fixed Slide and its background.
- [x] The Preview opens in an accordion beneath the selected row.
- [x] Only one Preview accordion can be open.
- [x] Opening another Preview closes the current one.
- [x] Closing uses a visible closing animation.
- [x] Closing or replacing a Preview revokes its object URL and releases the image.
- [x] Preview images are never stored in IndexedDB.
- [x] A rendering failure shows an inline Retry action.
- [x] Browser tests verify rendering, one-open behavior, retry, animation completion, and object-URL cleanup.

## Answer

Added `src/preview/` with a single-preview object-URL controller, accordion panel with 200ms close animation, and `useSlidePreview` hook that coordinates one-open behavior, replace-with-close, retry, and `window.__slaidePreviewTest` for object-URL and animation assertions. Editor sidebar rows now have a dedicated Preview button (Eye icon) separate from navigation; activating it renders via `renderSlideToPngBlob` (force-flushing the active scene when previewing the current slide) and shows the PNG in an accordion beneath the row. Closing or switching previews revokes the blob URL; nothing is written to IndexedDB. Five Playwright tests in Chromium and Firefox cover rendering, no-navigation, one-open switching, retry after injected failure, and close animation with URL cleanup. Four unit tests cover the preview controller lifecycle.
