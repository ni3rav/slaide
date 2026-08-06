# Slaide version 1

Status: ready-for-agent

## Problem Statement

People who prepare visual presentations need both free-form drawing tools and predictable slide boundaries. Excalidraw supplies capable drawing tools, but its infinite canvas, scene-oriented file actions, and live editor are not a complete slide-management experience.

The user needs a desktop application that organizes independent Excalidraw scenes as fixed 1920 by 1080 slides. The application must manage multiple decks, remain private and local-first, work offline after its first load, and present slides without retaining many live editors or generated images.

Browser-local storage also creates durability risks. The user needs explicit deck backup and restore without an application server.

## Solution

Build Slaide as an installable React PWA for desktop Chromium and Firefox. The home screen manages locally stored decks. The editor mounts one Excalidraw instance for the active slide and constrains its camera and elements to a fixed 1920 by 1080 surface through supported public APIs.

IndexedDB stores decks, slides, scenes, preferences, and schema metadata. A versioned `.slaide` file backs up or transfers exactly one deck. The sidebar manages slide order, selection, duplication, deletion, swapping, drag reorder, and temporary previews. Presentation mode renders temporary PNG images through Excalidraw export utilities and maintains a bounded five-image window.

## User Stories

1. As a presenter, I want to see all my decks on a home screen, so that I can choose what to edit.
2. As a presenter, I want decks ordered by recent activity, so that I can quickly find current work.
3. As a presenter, I want each deck entry to show its title, slide count, and last-modified time, so that I can identify it without opening it.
4. As a presenter, I want to create multiple decks, so that I can separate different presentations.
5. As a presenter, I want a new deck to start as `Untitled deck`, so that creation requires no setup.
6. As a presenter, I want a new deck to contain one blank slide, so that I can begin drawing immediately.
7. As a presenter, I want to open a deck from the home screen, so that I can continue editing it.
8. As a presenter, I want to rename a deck, so that its purpose is clear.
9. As a presenter, I want duplicate deck titles to be allowed, so that naming does not block my workflow.
10. As a presenter, I want to delete a deck with an explicit confirmation, so that I do not remove work accidentally.
11. As a presenter, I want deletion confirmation to identify the deck and its slide count, so that I know what will be lost.
12. As a presenter, I want to export one deck from the home screen, so that I can back it up.
13. As an editor, I want to export the active deck from the editor, so that I do not have to return home first.
14. As a presenter, I want to import a `.slaide` file from the home screen, so that I can restore or transfer a deck.
15. As a presenter, I want an imported deck to remain separate from existing decks, so that import cannot overwrite my work.
16. As a presenter, I want matching imported titles marked with ` (Imported)`, so that I can distinguish the new copy.
17. As a presenter, I want malformed or unsupported imports rejected before storage changes, so that bad files cannot corrupt local data.
18. As a presenter, I want clear errors for oversized imports and storage failures, so that I understand why import failed.
19. As a presenter, I want exported filenames based on the deck title, so that backup files are recognizable.
20. As a presenter, I want one `.slaide` file to contain the complete deck, so that backup does not require multiple files.
21. As a presenter, I want reloading a deck URL to reopen that local deck, so that browser navigation behaves predictably.
22. As a presenter, I want a missing or corrupt deck route to show a recoverable error, so that Slaide does not silently replace data.
23. As an editor, I want a Home action that saves before leaving, so that navigation does not lose recent work.
24. As an editor, I want a warning when the final save fails, so that I can decide whether to leave.
25. As an editor, I want every slide to use a fixed 1920 by 1080 surface, so that presentation output has a consistent aspect ratio.
26. As an editor, I want each slide to have an independent scene, so that editing one slide does not change another.
27. As an editor, I want all compatible Excalidraw shapes and drawing tools, so that I can build expressive slides.
28. As an editor, I want Excalidraw stroke, fill, font, alignment, opacity, layer, edge, arrow, and style controls, so that I can format slide content.
29. As an editor, I want to insert images, so that slides can contain visual assets.
30. As an editor, I want to select, erase, and move elements, so that I can revise slide content.
31. As an editor, I want to change the slide background color, so that the deck can use a suitable visual style.
32. As an editor, I want the slide background included in previews and presentations, so that output matches the editor.
33. As an editor, I want external links on elements to open only after my action, so that linked content cannot navigate unexpectedly.
34. As a privacy-conscious user, I want external websites to remain links instead of embedded content, so that the editor stays local-first.
35. As an editor, I want frames, collaboration, libraries, embeds, and AI controls removed, so that the interface matches a local fixed-slide workflow.
36. As an editor, I want native Excalidraw scene file actions removed, so that I do not confuse scene files with complete Slaide decks.
37. As an editor, I want the complete slide frame fitted when I open a slide, so that I immediately see the available surface.
38. As an editor, I want panning stopped at the slide boundary, so that the slide cannot disappear into an infinite canvas.
39. As an editor, I want zoom-out stopped when the complete slide fits the viewport, so that the slide remains usable.
40. As an editor, I want to zoom in to Excalidraw's supported maximum, so that I can edit details.
41. As an editor, I want camera corrections to happen without animation or bounce, so that the frame feels fixed.
42. As an editor, I want elements kept within the slide, so that all saved content appears in presentation output.
43. As an editor, I want moved elements clamped inside the slide, so that an accidental drag does not hide content.
44. As an editor, I want an invalid resize restored to its previous valid geometry, so that an element cannot become inaccessible.
45. As an editor, I want a newly inserted oversized image scaled proportionally to fit, so that insertion succeeds without distortion.
46. As an editor, I want only the active slide's Excalidraw instance mounted, so that memory use does not grow with the deck.
47. As an editor, I want the active scene saved before switching slides, so that its latest content reappears later.
48. As an editor, I accept that undo history resets after switching slides, so that Slaide can use only supported Excalidraw scene data.
49. As an editor, I want a numbered sidebar row for every slide, so that I can understand slide order.
50. As an editor, I want a row click to open its slide, so that navigation is direct.
51. As an editor, I want an Add slide action, so that I can expand the deck.
52. As an editor, I want a new slide inserted after the active slide, so that it appears where I am working.
53. As an editor, I want each slide row to have a separate checkbox, preview button, and drag handle, so that each action is unambiguous.
54. As an editor, I want selected slides to show Delete, Duplicate, and Swap actions, so that batch operations are discoverable.
55. As an editor, I want to delete all checked slides in one action, so that I can remove unwanted content efficiently.
56. As an editor, I want a new blank slide created when I delete every slide, so that a deck never becomes unusable.
57. As an editor, I want a predictable active slide after deletion, so that editing can continue without interruption.
58. As an editor, I want each checked slide duplicated directly after its source, so that copies remain near their originals.
59. As an editor, I want duplication to copy complete scenes and files, so that image content is preserved.
60. As an editor, I want Swap enabled only for exactly two checked slides, so that its effect is clear.
61. As an editor, I want Swap to exchange only two positions, so that other slide order remains unchanged.
62. As an editor, I want to drag one slide from a dedicated handle, so that dragging does not conflict with navigation or selection.
63. As an editor, I want a visible insertion indicator between rows, so that I know the exact drop position.
64. As an editor, I want dragging to insert rather than swap, so that reorder behaves like a slide list.
65. As an editor, I want checked state independent from drag reorder, so that selecting slides cannot unexpectedly move a group.
66. As an editor, I want checked slides preserved during navigation and reorder, so that I can finish a planned operation.
67. As an editor, I want checked state cleared after a selection action or deck change, so that stale selections do not cause later changes.
68. As an editor, I want an on-demand slide preview, so that I can inspect content without opening the slide.
69. As an editor, I want only one preview open, so that the sidebar remains manageable.
70. As an editor, I want preview images discarded when closed, so that temporary memory is released.
71. As an editor, I want a closing animation for previews, so that the interface clearly communicates the state change.
72. As an editor, I want to retry a failed preview, so that a transient rendering error is recoverable.
73. As an editor, I want scene changes saved shortly after I stop editing, so that crashes have a small data-loss window.
74. As an editor, I want visible Saving, Saved, and Save failed states, so that I know whether local persistence succeeded.
75. As an editor, I want failed saves to keep the deck marked unsaved, so that Slaide does not imply durability.
76. As an editor, I want another tab to open an already edited deck as read-only, so that concurrent tabs cannot overwrite one another.
77. As an editor, I want the read-only state explained, so that I know where the editing lock is held.
78. As a presenter, I want presentation mode to start immediately when I am already on slide one, so that no redundant dialog appears.
79. As a presenter, I want to choose current slide or beginning from later slides, so that I control the start point.
80. As a presenter, I want presentation mode to save current edits before starting, so that displayed images are current.
81. As a presenter, I want presentation mode to request fullscreen, so that the audience sees only the slide.
82. As a presenter, I want an in-page fallback when fullscreen is denied, so that presenting can continue.
83. As a presenter, I want click and Right Arrow to advance, so that navigation works with common inputs.
84. As a presenter, I want Left Arrow to go back, so that I can revisit a slide.
85. As a presenter, I want Escape to exit presentation mode, so that I can return to editing.
86. As a presenter, I want navigation to stop at deck boundaries, so that slides do not wrap unexpectedly.
87. As a presenter, I want the first navigation input to act immediately, so that controls feel responsive.
88. As a presenter, I want repeated navigation limited for 300 milliseconds, so that accidental rapid input does not skip slides.
89. As a presenter, I want only nearby presentation images retained, so that large decks use bounded image memory.
90. As a presenter, I want presentation to wait only for the starting image, so that startup is not delayed by the full deck.
91. As a presenter, I want a loading state when a target image is not ready, so that the application does not show stale content.
92. As a presenter, I want Retry and Exit after image-generation failure, so that the application never silently skips a slide.
93. As a presenter, I want presentation images to match slide bounds and backgrounds, so that output matches editing.
94. As a user, I want Slaide installable as a PWA, so that it behaves like a desktop application.
95. As a user, I want the application shell available offline after one successful load, so that I can edit without a network.
96. As a user, I want decks kept in IndexedDB instead of the service-worker cache, so that application updates do not replace user data.
97. As a user, I want an update prompt instead of an automatic reload, so that an update cannot interrupt unsaved work.
98. As a user, I want Slaide to request persistent storage, so that the browser is less likely to evict my decks.
99. As a user, I want Slaide to continue when persistent storage is denied, so that permission policy does not block editing.
100. As a privacy-conscious user, I want no telemetry or remote content transfer, so that deck content stays in my browser.
101. As a desktop user, I want a clear message on unsupported small viewports, so that I know to use a larger screen.
102. As a keyboard user, I want home and sidebar controls keyboard-operable, so that mouse input is not required for application controls.
103. As a keyboard user, I want visible focus indicators and correctly managed dialog focus, so that I can track navigation.
104. As a screen-reader user, I want icon controls to have accessible labels, so that their actions are understandable.
105. As a user, I want Slaide to follow my system theme initially, so that its appearance matches my environment.
106. As a user, I want to choose and retain a light or dark theme, so that appearance remains consistent across sessions.
107. As a user, I want clear recovery actions after loading, saving, migration, import, or rendering errors, so that failures do not strand me.
108. As a user, I want no arbitrary deck or slide limit, so that browser capacity is the only practical limit.

## Implementation Decisions

- Build three application surfaces: the home screen, editor, and presentation mode.
- Route those surfaces as the root, a deck-specific editor route, and a deck-specific presentation route.
- Use the domain terms Deck, Slide, Scene, Slide order, Active slide, Preview, Presentation image, and Slaide file consistently.
- Represent a deck with a schema version, generated ID, title, ordered slide IDs, creation time, and last-modified time.
- Represent a slide with a schema version, generated ID, owning deck ID, elements, persistent Excalidraw app state, binary files, creation time, and last-modified time.
- Keep deck and slide records separate. A deck owns at least one slide, and slide order contains each owned slide ID at most once.
- Store user and application data in IndexedDB. Use explicit forward schema versions and transactional migrations.
- Wrap multi-record creation, import, duplication, deletion, and reordering in transactions so failures cannot leave partial state.
- Request persistent browser storage after the first deck is created or imported.
- Use a 500 millisecond trailing debounce for normal scene saves.
- Force-save before slide changes, presentation entry, home navigation, and export. Attempt another immediate save when document visibility changes.
- Expose persistence status as Saving, Saved, or Save failed. Keep quota failures visible as unsaved state.
- Acquire a per-deck browser lock for editing. Open the deck read-only when another context owns its lock.
- Mount exactly one Excalidraw component for the Active slide. Force-save and unmount it before mounting the next Scene.
- Persist elements, compatible app state, and binary files. Remove camera, zoom, selection, dialog, active-tool, and other transient state before storage.
- Fit the entire 1920 by 1080 Slide whenever its Scene mounts.
- Observe camera changes through Excalidraw's public scroll callback and correct pan or minimum zoom through its public scene-update API.
- Calculate minimum zoom from the available editor viewport. Apply camera corrections immediately without animation and suppress correction loops.
- Validate complete visual element bounds after pointer release.
- Clamp an element when it fits, restore the previous valid geometry after an invalid resize, and proportionally scale a new oversized element.
- Keep compatible native drawing and styling controls. Remove frames, embeds, libraries, collaboration, AI, and native scene file actions.
- Permit explicit external links in a new tab, but do not render embedded websites.
- Use a dedicated Add slide action and separate row targets for navigation, selection, preview, and dragging.
- Implement slide-order operations as pure domain operations before committing the resulting order and records.
- Use `dnd-kit` for single-slide drag reorder through a dedicated handle. Do not use native HTML drag and drop.
- Generate sidebar Previews as PNG blobs on demand. Permit one open preview and revoke its object URL when closed or replaced.
- Define a versioned JSON Slaide file that contains one Deck and all owned Slides and Scenes.
- Limit import files to 100 MB. Validate schema, relationships, IDs, data types, and element bounds before any write.
- Generate new IDs for every imported Deck and Slide. Preserve both local and imported data after conflicts.
- Generate a filesystem-safe export name from the Deck title with a `.slaide` extension.
- Generate Presentation images as PNG blobs through Excalidraw's public export utility without a mounted editor.
- Maintain at most five Presentation images: the current Slide and up to two on either side.
- Revoke object URLs on presentation-window eviction and presentation exit.
- Accept the first navigation input immediately, then throttle navigation for 300 milliseconds.
- Request browser fullscreen for Presentation mode and use an in-page overlay after denial.
- Cache the application shell, bundled editor, fonts, icons, and static assets with a service worker.
- Keep IndexedDB user data outside the service-worker cache.
- Make the application installable and present an explicit update prompt before service-worker activation reloads the page.
- Support current desktop Chromium and Firefox. Block editing below 1024 pixels, including in an installed PWA.
- Follow system theme initially and persist an explicit light or dark preference in IndexedDB.
- Make application controls keyboard-operable with visible focus, accessible names, sufficient contrast, and correct dialog focus management.
- Make no runtime content, telemetry, analytics, or remote crash-reporting requests.
- Use the approved architectural decisions for local-first storage, one Scene per Slide, fixed boundaries, versioned Slaide files, and static-image presentation.

## Testing Decisions

- Prefer tests that observe user-visible or domain-visible behavior. Do not assert private React state, component structure, IndexedDB implementation details, or Excalidraw internals.
- Use the rendered browser application as the primary and highest testing seam.
- Run browser acceptance tests in Chromium and Firefox.
- Browser tests will cover home-screen deck management, editor routing, slide editing, sidebar controls, drag reorder, persistence across reloads, `.slaide` round trips, presentation controls, fullscreen fallback, PWA update behavior, offline reload, accessibility controls, and the viewport blocker.
- Use a pure domain-operation seam for deterministic edge cases that would be slow or opaque through the browser.
- Domain tests will cover insertion, deletion including delete-all replacement, duplication order, swapping, insertion-based drag reorder, active-slide selection after deletion, camera constraints, element bounds, filename generation, import validation, ID remapping, schema migrations, and presentation-window calculations.
- Use an IndexedDB repository seam in a real browser context for storage behavior.
- Repository integration tests will cover atomic creation, transaction rollback, autosave, forced save, migrations, quota failures, import commits, cascading deck deletion, and per-deck locking.
- Verify that normal save requests are debounced while workflow-boundary saves happen immediately.
- Verify that transient editor state is not restored and persistent Scene data is restored.
- Verify that malformed, unsupported, oversized, conflicting, and out-of-bounds imports cannot partially modify storage.
- Verify that temporary Preview and Presentation image object URLs are revoked when their lifecycle ends.
- Verify that presentation startup waits only for the first image and that the retained image count never exceeds five.
- Verify offline behavior after one successful online load. Do not claim first-visit offline support.
- Verify focus trapping, focus restoration, keyboard activation, accessible names, and visible focus at the application level.
- The repository has no existing automated test infrastructure or prior test patterns. Add the smallest toolchain that supports pure TypeScript tests, real-browser IndexedDB integration, and Chromium/Firefox acceptance tests.

## Out of Scope

- PDF deck export.
- PNG deck export.
- PPTX deck export.
- Native Excalidraw frames.
- A shared cross-slide Excalidraw canvas.
- Cached thumbnails on the home screen or editor sidebar.
- Moving multiple checked slides as one drag group.
- Mobile and touch editing.
- Viewports narrower than 1024 pixels.
- Safari support.
- Server-side persistence, accounts, synchronization, or collaboration.
- Real-time collaboration.
- Telemetry, analytics, and remote crash reporting.
- Recoverable trash for deleted decks.
- Cross-slide undo and redo history.
- Animated presentation transitions.
- A configured maximum zoom below Excalidraw's supported maximum.
- Automatic service-worker reload while work may be unsaved.

## Further Notes

- The approved product requirements are the source for detailed acceptance behavior.
- The domain glossary defines canonical terminology and invariants.
- The five accepted architectural decisions govern storage and PWA behavior, Excalidraw lifecycle, fixed boundaries, Slaide file compatibility, and Presentation image rendering.
- Excalidraw supplies public callbacks for scene and camera changes, an imperative scene-update API, and standalone image-export utilities. Slaide must not depend on private Excalidraw internals.
- Minimum-zoom enforcement is reactive because Excalidraw does not expose a documented minimum-zoom property. A small correction snap is acceptable, but bounce, animation, and feedback loops are not.
- JSON is intentionally used for version 1 Slaide files. Compression can be reconsidered only after measured deck sizes justify it.
- The local issue tracker records this spec as ready for implementation.
