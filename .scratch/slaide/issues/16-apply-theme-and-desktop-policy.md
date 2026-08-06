# 16 — Apply theme and desktop viewport policy

**What to build:** Slaide follows and remembers the user's visual theme while clearly restricting editing to supported desktop-sized viewports.

**Blocked by:** 01 — Create and reopen a local Deck; 03 — Draw and autosave one Scene

**Status:** ready-for-agent

- [ ] Slaide uses the operating-system theme when no explicit preference exists.
- [ ] The user can select light or dark theme.
- [ ] The selected theme applies coherently to the application and Excalidraw.
- [ ] The explicit theme preference persists in IndexedDB across reloads.
- [ ] A viewport below 1024 pixels blocks editing and shows the approved larger-screen message.
- [ ] The blocker applies in a browser tab and an installed PWA.
- [ ] Returning to a supported viewport restores access without losing data.
- [ ] The policy uses viewport width rather than user-agent detection.
- [ ] Browser tests cover system preference, explicit preference, reload, threshold boundaries, resizing, and installed display mode.
