# 13 — Bound Presentation image memory

**What to build:** Presentation mode stays responsive and memory-bounded by generating nearby images, evicting distant images, and handling navigation before rendering completes.

**Blocked by:** 12 — Present static Slide images

**Status:** resolved

- [x] Presentation waits only for the starting image before display.
- [x] Neighboring images generate concurrently after entry.
- [x] The retained window contains the current Slide and up to two Slides on each side.
- [x] No more than five Presentation images are retained.
- [x] Navigation generates the newly required image and evicts every image outside the window.
- [x] Eviction and exit revoke each affected object URL.
- [x] The first accepted navigation input acts immediately.
- [x] Further navigation input is ignored for 300 milliseconds.
- [x] Navigating to an unfinished image shows a loading state until it is ready.
- [x] Generation failure shows Retry and Exit and never silently skips the Slide.
- [x] Pure and browser tests cover window boundaries, forward and backward movement, rapid input, delayed rendering, failure, retry, and URL cleanup.

## Answer

Extended `presentation-image-cache.ts` with a five-slide window (`presentation-window.ts`), concurrent neighbor preloading, eviction with `URL.revokeObjectURL`, and late-render dropping. Added `presentation-navigation-throttle.ts` (300 ms) and updated `PresentationPage.tsx` to update the slide index immediately, show loading when the target image is not cached, throttle further input, and call `ensureWindow` on entry and navigation. Six new Playwright tests cover max-five retention, loading during delayed render, rapid-input throttling, failure Retry/Exit, and eviction during forward/backward navigation; unit and browser tests cover window math, throttle timing, cache eviction, and URL cleanup.
