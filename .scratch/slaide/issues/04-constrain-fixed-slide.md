# 04 — Constrain the fixed Slide

**What to build:** The editor behaves as a fixed 1920 by 1080 Slide instead of an infinite canvas, keeping the camera and complete element bounds within the presentation surface.

**Blocked by:** 03 — Draw and autosave one Scene

**Status:** resolved

- [x] Opening a Slide fits the complete 1920 by 1080 frame in the available editor viewport.
- [x] The user cannot pan the camera beyond the Slide boundary.
- [x] The user cannot zoom out below the fitted minimum and can zoom in to Excalidraw's supported maximum.
- [x] Camera corrections use supported public APIs, happen immediately, do not animate, and do not loop.
- [x] An element that can fit is clamped until its complete visual bounds are inside the Slide.
- [x] An invalid resize of an existing element restores its previous valid geometry.
- [x] A newly inserted oversized element is proportionally scaled to fit.
- [x] Boundary behavior covers rotated, grouped, bound, linear, free-draw, text, and image elements.
- [x] Scene persistence never records invalid element bounds after a completed gesture.
- [x] Pure tests cover camera and geometry edge cases, and browser tests verify representative Excalidraw interactions.

## Answer

Added pure slide camera math and element-boundary enforcement, wired through a slide constraint controller on the Excalidraw API (`onScrollChange`, `onPointerDown`/`onPointerUp`, `updateScene`, `onDuplicate`). Opening a slide fits the 1920×1080 frame; pan/zoom clamp immediately without animation loops; elements clamp, restore invalid resizes, or scale when newly inserted oversized. Autosave skips in-progress gestures and only persists in-bounds elements. Unit tests cover camera math; browser tests cover geometry with Excalidraw APIs; Playwright verifies fit, camera clamp, oversized insert, and move clamp in the editor.
