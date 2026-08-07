# 15 — Install and use Slaide offline

**What to build:** A user can install Slaide, reopen it offline after one successful load, continue local Deck workflows, and apply updates without an automatic disruptive reload.

**Blocked by:** 03 — Draw and autosave one Scene; 11 — Import a Slaide file atomically

**Status:** resolved

- [x] Slaide exposes valid installable PWA metadata and application icons.
- [x] The service worker caches the application shell, bundled editor, fonts, icons, and static assets.
- [x] The service-worker cache never stores Deck or Slide data.
- [x] After one online load, the user can reopen Slaide offline and edit existing Decks.
- [x] `.slaide` import and export work offline.
- [x] Creating or importing the first Deck requests persistent browser storage.
- [x] Denied persistent storage does not block the workflow.
- [x] An available application update shows a Reload action.
- [x] The application does not reload automatically while work can be unsaved.
- [x] Offline or update checks do not send user content, telemetry, analytics, or crash reports.
- [x] Browser tests verify installation, cached reload, offline editing, import/export, storage denial, and update activation.

## Answer

Added `vite-plugin-pwa` with installable manifest/icons, Workbox precaching of the app shell (not IndexedDB data), `registerType: 'prompt'` plus `AppUpdatePrompt` Reload UX, and persistent-storage requests wired into first deck create/import on `HomePage`. Playwright e2e now serves a production build on port 4174 and covers manifest/icons, SW caching, offline reopen/edit, offline import/export, storage denial, and update Reload activation.
