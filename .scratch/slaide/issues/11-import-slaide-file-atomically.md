# 11 — Import a Slaide file atomically

**What to build:** A user can import a complete `.slaide` backup from the home screen without overwriting local data or leaving partial records after invalid input or storage failure.

**Blocked by:** 04 — Constrain the fixed Slide; 10 — Export one Deck as a Slaide file

**Status:** ready-for-agent

- [ ] The home screen accepts one `.slaide` file up to 100 MB.
- [ ] The complete file is validated before any storage write.
- [ ] Validation covers format version, required data, ownership, Slide order, binary files, and element boundaries.
- [ ] Malformed, unsupported, oversized, and out-of-bounds files fail with a clear error.
- [ ] Import generates a new Deck ID and new Slide IDs.
- [ ] Imported Slide order and Scene relationships use the remapped IDs.
- [ ] Existing Decks are never overwritten.
- [ ] A matching local title gains the suffix ` (Imported)`.
- [ ] All imported records commit in one transaction, and failure leaves storage unchanged.
- [ ] A storage-quota failure is reported clearly.
- [ ] Export-then-import round trips preserve complete Scene content while changing identities.
- [ ] Pure, repository, and browser tests cover valid files, every rejection class, conflict behavior, rollback, and round trips.
