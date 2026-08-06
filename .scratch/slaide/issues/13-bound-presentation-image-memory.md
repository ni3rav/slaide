# 13 — Bound Presentation image memory

**What to build:** Presentation mode stays responsive and memory-bounded by generating nearby images, evicting distant images, and handling navigation before rendering completes.

**Blocked by:** 12 — Present static Slide images

**Status:** ready-for-agent

- [ ] Presentation waits only for the starting image before display.
- [ ] Neighboring images generate concurrently after entry.
- [ ] The retained window contains the current Slide and up to two Slides on each side.
- [ ] No more than five Presentation images are retained.
- [ ] Navigation generates the newly required image and evicts every image outside the window.
- [ ] Eviction and exit revoke each affected object URL.
- [ ] The first accepted navigation input acts immediately.
- [ ] Further navigation input is ignored for 300 milliseconds.
- [ ] Navigating to an unfinished image shows a loading state until it is ready.
- [ ] Generation failure shows Retry and Exit and never silently skips the Slide.
- [ ] Pure and browser tests cover window boundaries, forward and backward movement, rapid input, delayed rendering, failure, retry, and URL cleanup.
