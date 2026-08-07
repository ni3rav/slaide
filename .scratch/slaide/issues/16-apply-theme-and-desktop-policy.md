# 16 — Apply theme and desktop viewport policy

**What to build:** Slaide follows and remembers the user's visual theme while clearly restricting editing to supported desktop-sized viewports.

**Blocked by:** 01 — Create and reopen a local Deck; 03 — Draw and autosave one Scene

**Status:** resolved

- [x] Slaide uses the operating-system theme when no explicit preference exists.
- [x] The user can select light or dark theme.
- [x] The selected theme applies coherently to the application and Excalidraw.
- [x] The explicit theme preference persists in IndexedDB across reloads.
- [x] A viewport below 1024 pixels blocks editing and shows the approved larger-screen message.
- [x] The blocker applies in a browser tab and an installed PWA.
- [x] Returning to a supported viewport restores access without losing data.
- [x] The policy uses viewport width rather than user-agent detection.
- [x] Browser tests cover system preference, explicit preference, reload, threshold boundaries, resizing, and installed display mode.

## Answer

Added `ThemeProvider` with system-theme fallback and IndexedDB persistence via a new `settings` store (DB v2), `ThemeSelector` on home and editor, and Excalidraw `theme` sync. Added `ViewportGate` using `window.innerWidth` at 1024px with the PRD blocker message while keeping editor state mounted. Covered by unit tests for theme/viewport policy and preferences repository, plus Playwright Chromium/Firefox tests.
