# ADR-0001: Use local-first IndexedDB storage and a PWA shell

Status: Accepted  
Date: 2026-08-06

## Context

Slaide must work without an application server. Scenes can contain binary image data, which can exceed localStorage limits. Users also need to reopen the application without a network connection.

Browser storage can fail because of quota limits or eviction. Multiple browser contexts can also overwrite the same deck.

## Decision

- Store decks, slides, preferences, and schema metadata in IndexedDB.
- Use transactions for operations that change multiple records.
- Debounce ordinary scene saves by 500 milliseconds and force-save at workflow boundaries.
- Request persistent storage after the first deck is created or imported.
- Use a per-deck browser lock. Additional contexts open that deck read-only.
- Cache the application shell and static assets with a service worker.
- Keep user data out of the service-worker cache.
- Make the application installable as a PWA.
- Prompt before activating an available application update.
- Send no telemetry or user content to remote services.

## Consequences

- The application can edit existing decks offline after one successful load.
- Storage capacity and durability remain subject to browser policy.
- Save and migration failures need visible, recoverable states.
- IndexedDB migrations and transaction behavior require integration tests.
- Mobile installation does not remove the desktop viewport restriction.
