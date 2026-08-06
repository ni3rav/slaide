# 02 — Manage the Deck library

**What to build:** Home-screen Deck management that lets the user identify, rename, order, and permanently delete complete Decks.

**Blocked by:** 01 — Create and reopen a local Deck

**Status:** ready-for-agent

- [ ] Each Deck entry shows its title, Slide count, and last-modified time.
- [ ] Decks are ordered by most recently modified.
- [ ] The user can rename a Deck, and duplicate titles are accepted.
- [ ] Renaming updates the Deck's last-modified time and home-screen order.
- [ ] Deletion requires confirmation that includes the Deck title and Slide count.
- [ ] Confirmed deletion removes the Deck and all owned Slides in one transaction.
- [ ] Canceling deletion leaves all records unchanged.
- [ ] The home screen does not generate Deck thumbnails.
- [ ] Browser and repository tests cover rename, ordering, cancel, successful deletion, and rollback.
