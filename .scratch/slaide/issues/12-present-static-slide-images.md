# 12 — Present static Slide images

**What to build:** A user can start Presentation mode at the correct Slide and navigate static images in fullscreen or a safe in-page fallback without mounting Excalidraw.

**Blocked by:** 03 — Draw and autosave one Scene; 05 — Add and navigate independent Slides

**Status:** resolved

- [x] Starting from Slide one enters Presentation mode immediately.
- [x] Starting from a later Slide asks for From current slide or From beginning.
- [x] Entry force-saves the Active scene before image generation.
- [x] The starting Presentation image includes the fixed Slide bounds and background.
- [x] No Excalidraw instance is mounted in Presentation mode.
- [x] The application requests browser fullscreen.
- [x] Fullscreen denial continues in an in-page overlay with a non-blocking warning.
- [x] Click and Right Arrow advance, Left Arrow goes back, and Escape exits.
- [x] Navigation stops without wrapping at the first and final Slides.
- [x] Exiting releases generated image resources and returns to the Deck.
- [x] Browser tests cover both start choices, save failure, fullscreen success and denial, navigation boundaries, and clean exit.

## Answer

Added `/decks/:deckId/present` route with `PresentationPage` that renders 1920×1080 PNGs via Excalidraw `exportToBlob` (`slide-to-png.ts`) without mounting an editor. Editor header gains a Present button: slide 1 starts immediately; later slides show a start dialog. Entry force-flushes autosave before navigation; save failure surfaces `present-error`. Presentation requests fullscreen with an in-page overlay fallback and warning on denial. Click/ArrowRight advance, ArrowLeft goes back, Escape exits (including after fullscreen); navigation does not wrap. Object URLs are revoked on exit. Eight Playwright tests cover both start choices, save failure, fullscreen success/denial, navigation boundaries, 1920×1080 output, no Excalidraw host, and URL cleanup.
