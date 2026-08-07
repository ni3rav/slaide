# ADR-0004: Use a versioned Slaide file for deck backup

Status: Accepted  
Date: 2026-08-06

## Context

Browser-local storage can be cleared or evicted. Users need a backup and transfer mechanism without a server. Native Excalidraw export represents one scene and does not preserve a complete Slaide deck.

## Decision

- Define `.slaide` as a versioned JSON format.
- Store exactly one deck, its slide order, all owned scenes, and embedded binary files in each file.
- Provide deck export from the home screen and editor.
- Provide import from the home screen.
- Hide Excalidraw's native scene load, save, and export actions.
- Limit imported files to 100 MB.
- Validate the complete file, schema version, relationships, and element bounds before writing.
- Reject unsupported or invalid content without partial writes.
- Generate new deck and slide IDs during import.
- Preserve both decks after identity or title conflicts.
- Add ` (Imported)` when the imported title matches a local title.
- Write imported records in one IndexedDB transaction.

## Consequences

- Users can back up and transfer complete decks without a server.
- JSON is inspectable but may be large when scenes contain images.
- Import needs strict runtime validation and migration rules.
- The format must evolve through explicit versions.
- PDF deck export is addressed separately by ADR-0006; PNG and PPTX export remain deferred.
