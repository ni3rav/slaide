# 10 — Export one Deck as a Slaide file

**What to build:** A user can download one complete Deck as a recognizable, versioned `.slaide` backup from either the home screen or editor.

**Blocked by:** 03 — Draw and autosave one Scene; 05 — Add and navigate independent Slides

**Status:** ready-for-agent

- [ ] Export is available for one Deck from the home screen.
- [ ] Exporting from the editor force-saves and exports the Active deck.
- [ ] One file contains the Deck metadata, Slide order, all owned Scenes, and embedded binary files.
- [ ] The file is versioned JSON with a `.slaide` extension.
- [ ] The filename is a filesystem-safe form of the Deck title.
- [ ] Export does not include another Deck.
- [ ] Native Excalidraw scene and image export actions remain unavailable.
- [ ] A failed force-save prevents export and shows a clear error.
- [ ] Pure and browser tests verify schema output, ordering, binary files, filename sanitization, and both export entry points.
