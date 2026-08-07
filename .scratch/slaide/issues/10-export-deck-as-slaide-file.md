# 10 — Export one Deck as a Slaide file

**What to build:** A user can download one complete Deck as a recognizable, versioned `.slaide` backup from either the home screen or editor.

**Blocked by:** 03 — Draw and autosave one Scene; 05 — Add and navigate independent Slides

**Status:** resolved

- [x] Export is available for one Deck from the home screen.
- [x] Exporting from the editor force-saves and exports the Active deck.
- [x] One file contains the Deck metadata, Slide order, all owned Scenes, and embedded binary files.
- [x] The file is versioned JSON with a `.slaide` extension.
- [x] The filename is a filesystem-safe form of the Deck title.
- [x] Export does not include another Deck.
- [x] Native Excalidraw scene and image export actions remain unavailable.
- [x] A failed force-save prevents export and shows a clear error.
- [x] Pure and browser tests verify schema output, ordering, binary files, filename sanitization, and both export entry points.

## Answer

Added `src/slaide-file/` with versioned JSON serialization (`formatVersion: 1`), filesystem-safe filename generation, and browser download helpers. Home screen deck cards now include an Export action that loads one deck and downloads a `.slaide` file. The editor header adds Export deck, which force-saves the active scene before loading and exporting the deck. Failed force-saves show an inline export error and block download. Pure unit tests cover filename sanitization and serialize ordering/validation; Playwright e2e covers home and editor export, binary file embedding, single-deck isolation, force-save failure, and unchanged Excalidraw export restrictions.
