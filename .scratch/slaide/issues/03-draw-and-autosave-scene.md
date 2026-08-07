# 03 — Draw and autosave one Scene

**What to build:** A user can draw on the active Slide with the compatible Excalidraw tools and trust that the Scene is saved, restored, and visibly reports its persistence state.

**Blocked by:** 01 — Create and reopen a local Deck

**Status:** resolved

- [x] The editor mounts one Excalidraw instance for the Active slide.
- [x] Compatible shapes, drawing, text, image, eraser, selection, hand, styling, background, clear, and theme controls are available.
- [x] Frames, embeds, libraries, collaboration, AI, and native scene file actions are absent.
- [x] Scene elements, persistent app state, and binary files are stored after 500 milliseconds without a later change.
- [x] Camera, zoom, selection, dialogs, and active-tool state are not persisted.
- [x] The editor shows Saving, Saved, and Save failed states accurately.
- [x] Home navigation force-saves and warns before leaving after a failed save.
- [x] Visibility changes trigger an immediate save attempt.
- [x] Reloading restores the complete persistent Scene, including inserted images and background color.
- [x] External links open in a new tab only after explicit activation and are never embedded.
- [x] Browser and repository tests cover debounce, forced save, reload recovery, binary files, and failure status.

## Answer

Mounted one Excalidraw instance with compatible tools enabled and excluded UI removed (native file actions off, AI off, embeds rejected, frames/library triggers hidden). Added `toPersistentScene`, 500ms `createSceneAutosave`, and repository `saveScene` with Saving/Saved/Save failed status, visibility flush, and home force-save warning. Covered by unit, repository, and Playwright Chromium/Firefox tests.
