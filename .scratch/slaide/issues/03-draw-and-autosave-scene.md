# 03 — Draw and autosave one Scene

**What to build:** A user can draw on the active Slide with the compatible Excalidraw tools and trust that the Scene is saved, restored, and visibly reports its persistence state.

**Blocked by:** 01 — Create and reopen a local Deck

**Status:** ready-for-agent

- [ ] The editor mounts one Excalidraw instance for the Active slide.
- [ ] Compatible shapes, drawing, text, image, eraser, selection, hand, styling, background, clear, and theme controls are available.
- [ ] Frames, embeds, libraries, collaboration, AI, and native scene file actions are absent.
- [ ] Scene elements, persistent app state, and binary files are stored after 500 milliseconds without a later change.
- [ ] Camera, zoom, selection, dialogs, and active-tool state are not persisted.
- [ ] The editor shows Saving, Saved, and Save failed states accurately.
- [ ] Home navigation force-saves and warns before leaving after a failed save.
- [ ] Visibility changes trigger an immediate save attempt.
- [ ] Reloading restores the complete persistent Scene, including inserted images and background color.
- [ ] External links open in a new tab only after explicit activation and are never embedded.
- [ ] Browser and repository tests cover debounce, forced save, reload recovery, binary files, and failure status.
