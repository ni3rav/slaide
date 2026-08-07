# ADR-0006: Export decks as raster PDF documents

Status: Accepted
Date: 2026-08-08

## Context

Users need a portable, printable deck format in addition to the editable Slaide backup format. Slaide already renders stored scenes accurately as fixed-size PNG images. Producing vector PDF content would require a separate renderer and could diverge from presentation mode.

Large decks also make rendering every slide concurrently expensive in time and memory.

## Decision

- Export one complete deck as one PDF document.
- Preserve slide order with one borderless 16:9 PDF page per slide.
- Render each page with the existing fixed-size slide image renderer.
- Render slides sequentially and download only after every page succeeds.
- Keep PDF generation local and offline.
- Offer PDF and Slaide file export from the existing Home screen and Editor export actions.
- Force-save the active scene before Editor export.

## Consequences

- PDF output matches presentation rendering.
- Text and shapes are rasterized rather than selectable or scalable PDF objects.
- Sequential rendering bounds peak rendering work but can take longer for large decks.
- A failed slide prevents the entire PDF download instead of producing a partial document.
