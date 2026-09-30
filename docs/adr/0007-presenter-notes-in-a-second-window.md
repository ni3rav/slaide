# ADR-0007: Keep presenter notes out of the slide image

Status: Accepted
Date: 2026-09-30

## Context

A presenter needs notes on their own screen while the audience sees only the slide. Presentation mode renders a PNG of the whole scene, and PDF export uses that same image. Anything drawn on the slide is visible to the audience. Slide elements must also stay inside the fixed 1920 by 1080 bounds, so notes cannot sit beside the scene.

Presentation mode fullscreens one browser window. A notes strip inside that window appears on the projector or in a screen share.

## Decision

- Store presenter notes as plain text on the slide, beside the scene.
- Accept slides that omit notes so existing decks and version 1 Slaide files still load.
- Reject notes that are not text or that exceed 8,000 characters.
- Copy notes when a slide is duplicated.
- Include notes in the Slaide file when present. Do not pass them to slide image rendering.
- On Present, open a second window for the presenter view: current slide, next slide, and the current slide's notes.
- Keep the existing presentation route as the audience view.
- Sync the slide index between the two windows with a same-origin `BroadcastChannel`. The audience window owns the index.
- If the browser blocks the second window, continue the audience view and say so.
- Escape in either window ends the presentation.

## Consequences

- Audience images and PDF pages stay free of presenter notes.
- The presenter window must be opened from the Present click, before any await, or the browser blocks it.
- Notes are saved before that window navigates, so it reads the latest text.
- One screen still presents. The notes are available only when a second window can open.
