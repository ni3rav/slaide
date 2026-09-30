# Slaide domain context

## Purpose

Slaide is a local-first presentation editor. A user organizes fixed-size slides in decks and draws slide content with Excalidraw. Slaide stores user content in the browser and can back up one deck as a `.slaide` file.

## Glossary

### Deck

An ordered collection of slides. A deck has a title and owns its slide order.

Do not use **presentation** as a synonym for a deck. Presentation describes the display mode.

### Slide

A fixed 1920 by 1080 presentation surface. A slide owns one scene.

Do not use **page** or **canvas** as a synonym for a slide. Canvas refers to the Excalidraw editing surface.

### Scene

The persistent Excalidraw data for one slide:

- Elements.
- Persistent app state.
- Binary files.

Camera position, zoom, selection, dialogs, and active tool are transient state. They are not part of the persistent scene.

### Slide order

The ordered list of slide IDs owned by a deck. Sidebar navigation, duplication, swapping, deletion, and drag reorder change this list.

### Active slide

The slide currently mounted in the single live Excalidraw instance.

### Preview

A temporary PNG generated on demand for one sidebar slide. A preview is never persistent data.

### Presentation image

A temporary PNG used to display a slide in presentation mode. Presentation mode does not mount Excalidraw.

### Slaide file

A versioned JSON backup with a `.slaide` extension. One Slaide file contains exactly one deck, its ordered slides, and their scenes.

### PDF file

A downloaded document containing exactly one complete deck in slide order, with one slide on each borderless 16:9 page.

### Home screen

The deck-management surface. It creates, opens, renames, exports, imports, and deletes decks.

### Editor

The surface that combines the active Excalidraw scene with slide-management controls.

### Presenter notes

Plain text owned by a slide. Presenter notes are not part of the scene. Presentation images and PDF pages do not include them.

### Presentation mode

A fullscreen or in-page display mode that navigates static presentation images.

### Presenter view

A second window that shows the current slide, the next slide, and that slide's presenter notes. It follows presentation mode.

## Invariants

- A deck owns at least one slide.
- A slide belongs to exactly one deck.
- Every slide ID in slide order identifies a slide owned by that deck.
- Slide order does not contain duplicate slide IDs.
- A slide has one scene.
- A scene's complete element bounds remain inside 1920 by 1080.
- At most one Excalidraw instance is live.
- At most one browser context can edit a deck.
- Persistent deck changes are transactional.
- One Slaide file contains one deck.
- Preview and presentation images are temporary and their object URLs are revoked after use.
- Presenter notes are not rendered into presentation images.

## Primary workflows

### Create a deck

1. Create an `Untitled deck`.
2. Create one blank slide.
3. Store both records in one transaction.
4. Open the editor.

### Change the active slide

1. Force-save the active scene.
2. Unmount Excalidraw.
3. Load the target scene.
4. Mount a new Excalidraw instance fitted to the slide frame.

### Import a deck

1. Read and validate the complete Slaide file.
2. Reject unsupported, malformed, oversized, or out-of-bounds data.
3. Generate new deck and slide IDs.
4. Write all records in one transaction.

### Start presentation mode

1. Force-save the active scene.
2. Resolve the selected start point.
3. Generate the starting presentation image.
4. Enter fullscreen or use the in-page fallback.
5. Open the presenter view when the browser allows a second window.
6. Generate adjacent images for the sliding window.

## Architectural decisions

- [ADR-0001: Local-first IndexedDB and PWA](docs/adr/0001-local-first-indexeddb-and-pwa.md)
- [ADR-0002: One Excalidraw scene per slide](docs/adr/0002-one-excalidraw-scene-per-slide.md)
- [ADR-0003: Fixed slide boundaries through public APIs](docs/adr/0003-fixed-slide-boundaries-through-public-apis.md)
- [ADR-0004: Versioned Slaide import and export](docs/adr/0004-versioned-slaide-import-export.md)
- [ADR-0005: Static-image presentation rendering](docs/adr/0005-static-image-presentation-rendering.md)
- [ADR-0006: Raster PDF deck export](docs/adr/0006-raster-pdf-deck-export.md)
- [ADR-0007: Presenter notes in a second window](docs/adr/0007-presenter-notes-in-a-second-window.md)
