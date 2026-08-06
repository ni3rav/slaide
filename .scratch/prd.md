# Product Requirements Document

## Slaide

Document standard: ASD-STE100 (Simplified Technical English)  
Status: Approved for implementation  
Version: 2.0

---

## 1. Purpose

Slaide is a browser-based slide presentation tool. Each slide uses Excalidraw as its drawing engine. Slaide gives the user a fixed slide surface instead of an infinite canvas.

Slaide stores user data in the browser. It does not use an application server.

## 2. Supported environment

- Slaide must support current desktop Chromium and Firefox browsers.
- Slaide must support mouse and keyboard input.
- Slaide must not support editing when the viewport width is less than 1024 pixels.
- On a viewport that is less than 1024 pixels wide, Slaide must show: “Slaide requires a larger screen. Please use a desktop computer.”
- An installed PWA must apply the same viewport restriction.

## 3. Technology

- The user interface must use React and TypeScript.
- The build tool must be Vite.
- The drawing engine must be the public `@excalidraw/excalidraw` package.
- Slaide must not modify Excalidraw source code.
- IndexedDB must store application and user data.
- A service worker must cache the application shell and static assets.
- Slaide must be installable as a PWA.

## 4. Home screen

### 4.1 Deck list

- The home screen must show all decks.
- The home screen must sort decks by most recently modified.
- Each deck entry must show its title, slide count, and last-modified time.
- Deck entries must not show generated thumbnails in version 1.
- Deck titles do not have to be unique.

### 4.2 Deck actions

The user must be able to:

- Create a deck.
- Open a deck.
- Rename a deck.
- Export one deck.
- Delete a deck.
- Import a `.slaide` file.

The deck delete action must show a confirmation that contains the deck title and slide count. Deleted decks are not recoverable in version 1.

### 4.3 New decks

- A new deck must have the title `Untitled deck`.
- A new deck must contain one blank slide.
- Slaide must request persistent browser storage after the user creates or imports the first deck.
- Slaide must continue if the browser rejects the persistent-storage request.

## 5. Editor navigation

- The home screen route must be `/`.
- A deck editor route must be `/decks/:deckId`.
- A presentation route must be `/decks/:deckId/present`.
- Reloading an editor route must reopen the local deck.
- If the deck does not exist or cannot load, Slaide must show a recoverable error and a Return home action.
- Slaide must not create replacement data for a missing or corrupt deck.
- The editor must provide a Home action.
- The Home action must force a save before navigation.
- If that save fails, Slaide must warn the user before navigation.

## 6. Slide model

- A deck is an ordered collection of slides.
- Each slide must have a fixed logical size of 1920 by 1080 pixels.
- Each slide must be a separate Excalidraw scene.
- A scene contains Excalidraw elements, persistent app state, and binary files.
- A deck must store its slide order as an ordered list of slide IDs.
- A deck can contain duplicate slide content.
- A deck must always contain at least one slide.

## 7. Excalidraw instance

- Slaide must mount one Excalidraw instance for the active slide.
- Slaide must not keep another live Excalidraw instance in memory.
- Slaide must force-save the active scene before it leaves the slide.
- Slaide must unmount the instance when it leaves the slide.
- Slaide must mount a new instance with saved scene data when it opens a slide.
- Slaide must not cache Excalidraw instances in version 1.
- Undo and redo history may reset when the user leaves a slide.
- A slide must reopen with the complete frame fitted in the editor viewport.
- Slaide must not persist transient camera, selection, dialog, or active-tool state.

## 8. Fixed slide constraints

### 8.1 Pan and zoom

- The camera must not pan past the slide boundary.
- The minimum zoom must show the complete slide frame in the available viewport.
- The user may zoom in to Excalidraw's supported maximum.
- Slaide must use Excalidraw's public `onScrollChange` API to observe pan and zoom.
- Slaide must use the public `updateScene` API to correct invalid pan or zoom.
- A correction must happen immediately.
- A correction must not animate, bounce, or start a callback loop.

### 8.2 Element boundaries

- The complete visual bounding box of each element must remain inside the slide.
- Slaide must validate changed geometry after the pointer is released.
- Slaide must clamp an element to the slide when the element can fit.
- Slaide must restore the previous valid geometry when a resize makes an existing element too large.
- Slaide must proportionally scale a newly inserted oversized element to fit the slide.
- A `.slaide` import must fail validation if a saved element violates the slide boundary.
- Slaide must not silently change invalid imported content.

## 9. Drawing tools and menus

### 9.1 Included features

Slaide must keep Excalidraw features that work with a fixed, local slide:

- Selection.
- Hand and camera controls.
- Rectangle, ellipse, diamond, arrow, line, free draw, text, image, and eraser.
- Stroke and background colors.
- Fill, stroke, sloppiness, edge, opacity, layer, arrow, font, size, and alignment options.
- Canvas background color.
- Clear canvas.
- Light and dark themes.

The selected canvas background must appear in previews and presentation images.

### 9.2 Excluded features

Slaide must exclude:

- Excalidraw frame elements.
- Embeddable web content.
- The Excalidraw library panel.
- Real-time collaboration.
- AI tools.
- Native Excalidraw scene load, save, image export, and scene export actions.

The editor must provide a custom Export deck action. This action must export the complete active deck as one `.slaide` file.

### 9.3 Links

- Elements may contain external links.
- Slaide must open a link in a new browser tab only after an explicit user action.
- Slaide must not embed the linked website.

## 10. Sidebar

### 10.1 Slide rows

- The sidebar must show one numbered row for each slide.
- A row click must open that slide.
- A row must have a checkbox, preview button, and dedicated drag handle.
- These controls must not trigger row navigation.

### 10.2 Add slide

- The sidebar must show an Add slide action at the top.
- A new blank slide must be inserted immediately after the active slide.
- The new slide must become active.

### 10.3 Selection actions

- When one or more slides are checked, the sidebar must show Delete, Duplicate, and Swap actions.
- Checked slides must remain checked during slide navigation and drag reorder.
- Checked slides must clear after Delete, Duplicate, or Swap.
- Checked slides must clear when the user opens another deck.

### 10.4 Delete

- Delete must remove all checked slides and update slide order.
- If the active slide is deleted, the slide at its previous position must become active.
- If no slide follows, the preceding slide must become active.
- If all slides are deleted, Slaide must create and activate one blank slide.

### 10.5 Duplicate

- Duplicate must copy every checked scene and its files.
- Each copy must be inserted directly after its source.
- Copies must preserve source order.

### 10.6 Swap

- Swap must be enabled only when exactly two slides are checked.
- Swap must exchange only the two selected positions.
- All other slide positions must remain unchanged.

### 10.7 Drag reorder

- Slaide must use `dnd-kit`.
- Slaide must not use the native HTML Drag and Drop API.
- A drag must start only from the dedicated drag handle.
- Version 1 must support one dragged slide at a time.
- Checkbox state must not affect a drag.
- The sidebar must show the exact insertion point between rows.
- A drop must remove the slide ID from its old position and insert it at the indicated position.
- A drop must not swap the dragged slide with the target row.

## 11. Sidebar preview

- The preview button must open an accordion below its slide row.
- Only one preview accordion may be open.
- Opening another preview must close the current preview.
- Slaide must generate a preview PNG only when requested.
- Slaide must use Excalidraw's public export utility with the fixed 16:9 slide bounds.
- Slaide must not store the preview PNG.
- Closing a preview must use a closing animation.
- Closing a preview must revoke its object URL and release it from memory.
- A failed preview must show an inline Retry action.

## 12. Persistence

### 12.1 Autosave

- Excalidraw's `onChange` callback must supply elements, app state, and files.
- Slaide must save 500 milliseconds after the latest change.
- Slaide must force-save before slide changes, presentation mode, home navigation, and deck export.
- Slaide must attempt an immediate save on document visibility changes.
- The editor must show `Saving…`, `Saved`, or `Save failed`.
- A quota failure must leave the affected deck visibly unsaved.

### 12.2 Records

Each deck record must contain:

- Schema version.
- Deck ID.
- Title.
- Ordered slide ID list.
- Creation time.
- Last-modified time.

Each slide record must contain:

- Schema version.
- Slide ID.
- Owning deck ID.
- Excalidraw elements.
- Persistent Excalidraw app state.
- Excalidraw binary files.
- Creation time.
- Last-modified time.

A deck's last-modified time must change when its title, slide order, or any owned slide changes.

### 12.3 Transactions and migrations

- Multi-record writes must use IndexedDB transactions.
- Import, deletion, duplication, and reorder must not leave partial data.
- Schema upgrades must use explicit, forward, transactional migrations.
- Slaide must not silently downgrade unsupported newer data.

### 12.4 Concurrent tabs

- Only one browser context may edit a deck at a time.
- Slaide must use a per-deck browser lock.
- Another context must open the locked deck as read-only.
- Read-only mode must explain that the deck is open elsewhere.

## 13. `.slaide` files

### 13.1 Export

- One `.slaide` file must contain exactly one deck.
- The file must use versioned JSON.
- The file must include deck metadata, slide order, scenes, and embedded binary files.
- The filename must use a filesystem-safe form of the deck title.
- The filename must end in `.slaide`.
- Export must be available from the home screen and editor.

### 13.2 Import

- Import must be available from the home screen.
- The maximum import file size must be 100 MB.
- Slaide must validate the complete file before it writes any record.
- Invalid, malformed, out-of-bounds, or unsupported files must fail with a clear error.
- Import must not write partial data.
- Import must generate a new deck ID and new slide IDs.
- Import must keep both decks when content or IDs conflict.
- If an imported title matches a local title, Slaide must append ` (Imported)`.
- Slaide must report storage-quota failures.

## 14. Presentation mode

### 14.1 Entry

- The editor must provide a presentation action.
- If the active slide is the first slide, presentation must start immediately from it.
- Otherwise, Slaide must ask the user to select From current slide or From beginning.
- Slaide must force-save before presentation starts.

### 14.2 Display

- The presentation route must use static PNG images.
- Presentation mode must not use a live Excalidraw instance.
- Each PNG must use the fixed slide bounds and slide background.
- Slaide must request browser fullscreen.
- If fullscreen is denied, presentation must continue in an in-page overlay and show a non-blocking warning.
- Version 1 must not animate slide transitions.

### 14.3 Image window

- Slaide must keep at most five presentation images in memory.
- The target window is the current slide, two preceding slides, and two following slides.
- At the start or end of a deck, the window may contain fewer than five images.
- Presentation must wait only for the starting image.
- Slaide must generate neighboring images concurrently.
- Navigation must generate the newly required image and evict the image outside the window.
- Eviction must revoke the image's object URL.
- If a target image is not ready, Slaide must show a loading state.
- If generation fails, Slaide must show Retry and Exit actions.
- Slaide must not silently skip a failed slide.

### 14.4 Input

- A click or Right Arrow must move to the next slide.
- Left Arrow must move to the previous slide.
- Escape must exit presentation mode and fullscreen.
- Navigation must stop at the first and last slide.
- Navigation must not wrap.
- The first accepted input must act immediately.
- Slaide must ignore later navigation input for 300 milliseconds.

## 15. PWA and offline operation

- The PWA must cache the application shell, bundled Excalidraw code, fonts, icons, and static assets.
- The service-worker cache must not store deck data.
- After one successful online load, existing deck editing and `.slaide` import and export must work offline.
- A new application version must show an Update available message with a Reload action.
- Slaide must not reload automatically while a deck can have unsaved changes.

## 16. Theme and accessibility

- Slaide must use the system theme by default.
- The user must be able to select light or dark theme.
- Slaide must persist the theme preference in IndexedDB.
- Home-screen and sidebar controls must work with a keyboard.
- Interactive controls must have visible focus styles.
- Icon buttons must have accessible labels.
- Dialogs must trap focus and restore focus when they close.
- Text and controls must have sufficient color contrast.
- Excalidraw is responsible for accessibility inside its canvas.

## 17. Privacy and network use

- Slaide must not send deck or slide content to a server.
- Slaide must not use telemetry, analytics, or remote crash reporting.
- Runtime network requests may fetch only statically hosted application assets and application updates.

## 18. Error handling

- Slaide must show clear errors for failed saves, imports, migrations, image generation, and deck loading.
- Slaide must not discard valid stored data after an operation fails.
- Slaide must not impose an arbitrary deck-count or slide-count limit.
- Browser storage capacity is the practical limit.

## 19. Verification

### 19.1 Unit tests

Unit tests must cover:

- Slide insertion, deletion, duplication, swap, and reorder.
- Element and camera boundary calculations.
- Import validation and ID remapping.
- Filename generation.
- Schema migrations.
- Presentation-window calculations.

### 19.2 Integration tests

Integration tests must cover:

- IndexedDB deck and slide operations.
- Transaction rollback.
- Autosave and forced save.
- Import and export round trips.
- Per-deck browser locking.

### 19.3 Browser tests

Browser tests must cover:

- Deck creation and management.
- Slide editing and persistence.
- Sidebar interactions and drag reorder.
- Preview generation and cleanup.
- Presentation entry, navigation, and exit.
- PWA installation and offline reload.
- Chromium and Firefox.
- The viewport-width blocker.

## 20. Deferred work

Version 1 does not include:

- PDF, PNG, or PPTX deck export.
- Native Excalidraw frames.
- Cached home-screen or sidebar thumbnails.
- Multi-slide group drag.
- Mobile or touch editing.
- Safari support.
- Recoverable trash.
- Cross-slide undo history.
- Animated presentation transitions.

## 21. Canonical vocabulary

- **Deck**: An ordered collection of slides.
- **Slide**: A fixed 1920 by 1080 presentation surface.
- **Scene**: One slide's Excalidraw elements, persistent app state, and files.
- **Slide order**: The ordered list of slide IDs owned by a deck.
- **Preview**: A temporary PNG generated for one sidebar slide.
- **Presentation image**: A temporary PNG used in presentation mode.
- **Slaide file**: A versioned `.slaide` backup that contains exactly one deck.
