# ADR-0005: Render presentation mode with temporary static images

Status: Accepted  
Date: 2026-08-06

## Context

Presentation mode does not need editing controls. Mounting Excalidraw during presentation would retain editor state and make slide changes more expensive. Rendering every slide in advance can consume excessive time and memory for large decks.

Excalidraw provides public utilities that render stored elements, app state, and files to image blobs without a live editor instance.

## Decision

- Render presentation slides as PNG blobs at the fixed slide bounds.
- Do not mount Excalidraw in presentation mode.
- Wait for the starting image before showing the presentation.
- Generate neighboring images concurrently.
- Keep a window of at most five images: the current slide and up to two slides on each side.
- Generate newly required images and evict images outside the window as navigation changes.
- Revoke every evicted object URL.
- Navigate immediately on the first accepted input and throttle further input for 300 milliseconds.
- Use fullscreen when available and an in-page overlay when fullscreen is denied.
- Do not animate transitions in version 1.
- Show loading, Retry, and Exit states instead of silently skipping unavailable images.

## Consequences

- Presentation mode has lower editor-state and memory overhead.
- Initial entry waits only for one image.
- Fast navigation can reach an image that is still rendering and must show loading.
- Image generation and object-URL cleanup require lifecycle tests.
- A five-image window gives predictable memory use independent of deck size.
