# 15 — Install and use Slaide offline

**What to build:** A user can install Slaide, reopen it offline after one successful load, continue local Deck workflows, and apply updates without an automatic disruptive reload.

**Blocked by:** 03 — Draw and autosave one Scene; 11 — Import a Slaide file atomically

**Status:** ready-for-agent

- [ ] Slaide exposes valid installable PWA metadata and application icons.
- [ ] The service worker caches the application shell, bundled editor, fonts, icons, and static assets.
- [ ] The service-worker cache never stores Deck or Slide data.
- [ ] After one online load, the user can reopen Slaide offline and edit existing Decks.
- [ ] `.slaide` import and export work offline.
- [ ] Creating or importing the first Deck requests persistent browser storage.
- [ ] Denied persistent storage does not block the workflow.
- [ ] An available application update shows a Reload action.
- [ ] The application does not reload automatically while work can be unsaved.
- [ ] Offline or update checks do not send user content, telemetry, analytics, or crash reports.
- [ ] Browser tests verify installation, cached reload, offline editing, import/export, storage denial, and update activation.
