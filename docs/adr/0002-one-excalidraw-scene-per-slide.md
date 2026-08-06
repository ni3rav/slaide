# ADR-0002: Use one Excalidraw scene per slide

Status: Accepted  
Date: 2026-08-06

## Context

Slaide needs independent slides and must limit editor memory use. A shared infinite scene or one mounted editor per slide would conflict with the fixed-slide model or retain many live Excalidraw instances.

Excalidraw does not expose persistent undo history through its public scene data.

## Decision

- Model each slide as one independent Excalidraw scene.
- Store elements, persistent app state, and binary files with the slide.
- Mount one Excalidraw instance for the active slide.
- Force-save and unmount that instance before opening another slide.
- Mount a new instance with the target scene.
- Fit the complete slide frame whenever a scene opens.
- Do not persist camera, zoom, selection, dialogs, active tool, or undo history.
- Do not cache mounted instances in version 1.

## Consequences

- Editor memory does not grow with the number of slides.
- Slides can be stored, copied, imported, and exported independently.
- Slide changes include an unmount and mount cycle.
- Undo and redo history resets after the user leaves a slide.
- Autosave must continuously capture binary files before unmounting.
