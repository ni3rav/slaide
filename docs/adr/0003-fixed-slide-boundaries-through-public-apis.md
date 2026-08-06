# ADR-0003: Enforce fixed slide boundaries through public APIs

Status: Accepted  
Date: 2026-08-06

## Context

Excalidraw is an infinite-canvas editor. Slaide requires a fixed 1920 by 1080 slide and must not modify Excalidraw source code.

The public component API reports camera changes through `onScrollChange` and permits app-state corrections through `updateScene`. It does not provide a documented minimum-zoom property. Element gestures also cannot all be cancelled before Excalidraw applies them.

## Decision

- Use a fixed 1920 by 1080 logical coordinate space for every slide.
- Derive minimum zoom from the available editor viewport.
- Observe pan and zoom through `onScrollChange`.
- Correct invalid camera state immediately through `updateScene`.
- Do not animate corrections, and guard against callback loops.
- Validate complete visual element bounds after pointer release.
- Clamp elements that can fit.
- Restore the previous valid geometry after an invalid resize.
- Proportionally scale a newly inserted oversized element to fit.
- Reject imported scenes with out-of-bounds elements.
- Use only supported Excalidraw APIs.

## Consequences

- Camera correction can have a small visual snap because enforcement is reactive.
- Rotated, grouped, bound, linear, and free-draw elements require reliable visual-bound calculations.
- Imported content is never silently changed.
- Boundary calculations require focused unit and browser tests.
- Excalidraw upgrades must be checked for public-API and geometry changes.
