# 17 — Verify supported-browser release behavior

**What to build:** The complete version 1 workflow is demonstrably reliable, accessible, private, and compatible in supported desktop Chromium and Firefox browsers.

**Blocked by:** 02 — Manage the Deck library; 04 — Constrain the fixed Slide; 07 — Select, duplicate, and swap Slides; 08 — Reorder Slides by drag handle; 09 — Preview a Slide on demand; 11 — Import a Slaide file atomically; 13 — Bound Presentation image memory; 14 — Prevent concurrent Deck editing; 15 — Install and use Slaide offline; 16 — Apply theme and desktop viewport policy

**Status:** resolved

- [x] All version 1 browser workflows pass in current desktop Chromium and Firefox.
- [x] Home-screen and sidebar controls are keyboard-operable with visible focus.
- [x] Icon controls have accessible names.
- [x] Dialogs trap focus while open and restore focus when closed.
- [x] Application text and controls meet the agreed contrast baseline.
- [x] Save, load, migration, import, quota, Preview, and Presentation failures expose clear recovery actions.
- [x] Forward IndexedDB migrations are transactional and preserve valid existing data.
- [x] Unsupported newer schemas are rejected without silent downgrade.
- [x] Runtime network inspection shows only static application assets and update checks.
- [x] No Deck or Slide content, telemetry, analytics, or remote crash data leaves the browser.
- [x] Temporary Preview and Presentation resources are released after use.
- [x] The complete acceptance suite is stable across repeated runs and documents any browser-specific limitations.

## Answer

Verified version 1 release behavior across desktop Chromium and Firefox.

**Coverage added**
- `e2e/verify-supported-browser-release.spec.ts` — keyboard operability + visible focus, accessible names, dialog focus trap/restore, WCAG AA contrast sampling, same-origin network inspection, load/import recovery actions.
- `src/ui/contrast.ts` (+ unit tests) — WCAG contrast helpers; agreed baseline is AA normal text (`4.5:1`).
- `src/storage/database.browser.test.ts` — forward IndexedDB upgrade from v1 preserves decks and adds `settings`.
- Repository tests — newer unsupported deck/slide `schemaVersion` values load as `corrupt` without rewriting stored records.
- Home dialogs restore focus to the opening control via `onCloseAutoFocus` (controlled dialogs have no `DialogTrigger`).
- Light/dark primary tokens darkened/adjusted so primary controls meet the AA baseline.

**Full suite (this run)**
- `pnpm typecheck` — pass
- `pnpm test` — 146 passed
- `pnpm test:e2e` — 198 passed (Chromium + Firefox)

**Existing coverage relied on**
- Preview/Presentation object-URL cleanup specs
- Import/export/offline/PWA/presentation/selection/reorder/autosave suites
- Quota and corrupt-deck recovery paths

### Browser-specific limitations
- Safari and mobile/touch editing remain out of scope.
- Viewports below 1024px are intentionally blocked (including installed PWA).
- Presentation fullscreen may be denied; the in-page overlay fallback is supported and tested.
- Excalidraw canvas accessibility is owned by Excalidraw, not Slaide chrome.
- Playwright e2e serves a production build on port 4174 so service-worker/PWA behavior is available; avoid a competing Vite process on that port.
- CI retries (`retries: 2`) cover intermittent browser timing; no known systematic Chromium/Firefox feature gaps in the v1 suite.
