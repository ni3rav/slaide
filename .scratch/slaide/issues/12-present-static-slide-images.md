# 12 — Present static Slide images

**What to build:** A user can start Presentation mode at the correct Slide and navigate static images in fullscreen or a safe in-page fallback without mounting Excalidraw.

**Blocked by:** 03 — Draw and autosave one Scene; 05 — Add and navigate independent Slides

**Status:** ready-for-agent

- [ ] Starting from Slide one enters Presentation mode immediately.
- [ ] Starting from a later Slide asks for From current slide or From beginning.
- [ ] Entry force-saves the Active scene before image generation.
- [ ] The starting Presentation image includes the fixed Slide bounds and background.
- [ ] No Excalidraw instance is mounted in Presentation mode.
- [ ] The application requests browser fullscreen.
- [ ] Fullscreen denial continues in an in-page overlay with a non-blocking warning.
- [ ] Click and Right Arrow advance, Left Arrow goes back, and Escape exits.
- [ ] Navigation stops without wrapping at the first and final Slides.
- [ ] Exiting releases generated image resources and returns to the Deck.
- [ ] Browser tests cover both start choices, save failure, fullscreen success and denial, navigation boundaries, and clean exit.
