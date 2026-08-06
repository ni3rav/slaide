# 17 — Verify supported-browser release behavior

**What to build:** The complete version 1 workflow is demonstrably reliable, accessible, private, and compatible in supported desktop Chromium and Firefox browsers.

**Blocked by:** 02 — Manage the Deck library; 04 — Constrain the fixed Slide; 07 — Select, duplicate, and swap Slides; 08 — Reorder Slides by drag handle; 09 — Preview a Slide on demand; 11 — Import a Slaide file atomically; 13 — Bound Presentation image memory; 14 — Prevent concurrent Deck editing; 15 — Install and use Slaide offline; 16 — Apply theme and desktop viewport policy

**Status:** ready-for-agent

- [ ] All version 1 browser workflows pass in current desktop Chromium and Firefox.
- [ ] Home-screen and sidebar controls are keyboard-operable with visible focus.
- [ ] Icon controls have accessible names.
- [ ] Dialogs trap focus while open and restore focus when closed.
- [ ] Application text and controls meet the agreed contrast baseline.
- [ ] Save, load, migration, import, quota, Preview, and Presentation failures expose clear recovery actions.
- [ ] Forward IndexedDB migrations are transactional and preserve valid existing data.
- [ ] Unsupported newer schemas are rejected without silent downgrade.
- [ ] Runtime network inspection shows only static application assets and update checks.
- [ ] No Deck or Slide content, telemetry, analytics, or remote crash data leaves the browser.
- [ ] Temporary Preview and Presentation resources are released after use.
- [ ] The complete acceptance suite is stable across repeated runs and documents any browser-specific limitations.
