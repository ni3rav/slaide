# 02 — Manage the Deck library

**What to build:** Home-screen Deck management that lets the user identify, rename, order, and permanently delete complete Decks.

**Blocked by:** 01 — Create and reopen a local Deck

**Status:** resolved

- [x] Each Deck entry shows its title, Slide count, and last-modified time.
- [x] Decks are ordered by most recently modified.
- [x] The user can rename a Deck, and duplicate titles are accepted.
- [x] Renaming updates the Deck's last-modified time and home-screen order.
- [x] Deletion requires confirmation that includes the Deck title and Slide count.
- [x] Confirmed deletion removes the Deck and all owned Slides in one transaction.
- [x] Canceling deletion leaves all records unchanged.
- [x] The home screen does not generate Deck thumbnails.
- [x] Browser and repository tests cover rename, ordering, cancel, successful deletion, and rollback.

## Answer

Added `renameDeck` and `deleteDeck` on the IndexedDB repository (list sorted by `updatedAt`, cascade delete in one transaction with abort rollback coverage). Home screen shows title, slide count, and last-modified time, with rename/delete dialogs and no thumbnails. Covered by Vitest browser repository tests and Playwright Chromium/Firefox acceptance tests.
