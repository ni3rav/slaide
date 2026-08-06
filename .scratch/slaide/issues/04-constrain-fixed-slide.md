# 04 — Constrain the fixed Slide

**What to build:** The editor behaves as a fixed 1920 by 1080 Slide instead of an infinite canvas, keeping the camera and complete element bounds within the presentation surface.

**Blocked by:** 03 — Draw and autosave one Scene

**Status:** ready-for-agent

- [ ] Opening a Slide fits the complete 1920 by 1080 frame in the available editor viewport.
- [ ] The user cannot pan the camera beyond the Slide boundary.
- [ ] The user cannot zoom out below the fitted minimum and can zoom in to Excalidraw's supported maximum.
- [ ] Camera corrections use supported public APIs, happen immediately, do not animate, and do not loop.
- [ ] An element that can fit is clamped until its complete visual bounds are inside the Slide.
- [ ] An invalid resize of an existing element restores its previous valid geometry.
- [ ] A newly inserted oversized element is proportionally scaled to fit.
- [ ] Boundary behavior covers rotated, grouped, bound, linear, free-draw, text, and image elements.
- [ ] Scene persistence never records invalid element bounds after a completed gesture.
- [ ] Pure tests cover camera and geometry edge cases, and browser tests verify representative Excalidraw interactions.
