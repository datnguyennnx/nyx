# Triage

## Why

Prompts arrive ambiguous or carry a false premise. Classify every item before you act. An unverified premise ships the wrong change and burns a lane.

## Four classes

- **ACT**: verifiable, scoped, and free of conflict with canonical. Test: you can cite the repo evidence and the exact files, so do it.
- **MERGE**: overlaps an existing rule or artifact. Test: a canonical file already covers it, so fold it in and do not add a parallel copy.
- **DRAFT**: speculative, unverifiable, or idea-only. Test: you cannot verify it now, so record it and change no behavior and no gate.
- **DISCARD**: contradicts a verified fact, is destructive without approval, or duplicates another item. Test: it fails one of those three, so drop it with a stated reason.

## Resolution order

When items conflict, pick by this order: verified fact, then explicit user intent, then mas convention. Mark the loser DRAFT or DISCARD with a stated reason. Never let a convention defeat an explicit user intent, and never let an intent defeat a verified fact.

## Never silently implement a premise

Verify a premise against the repo before you act. Use glob, read, and grep on the named files. If the premise holds, the item can be ACT. If you cannot verify it, the item is DRAFT, not ACT. State what you checked and what you could not verify.

## Ledger

Record every DRAFT in this table. Keep one row per item and update the promotion condition as evidence arrives.

| id | date | source | class | reason | promotion condition |
|---|---|---|---|---|---|
| D-001 | 2026-09-30 | user ask | DRAFT | Assumes a cache layer that no file defines | A file defines the cache layer |

## Output

When a request has two or more items, or any ambiguous item, print this table before you spawn anything.

| item | class | reason |
|---|---|---|
| Add the retry cap | MERGE | `references/verification.md` already sets the cap |
| Rewrite storage | DRAFT | No verified target file exists |

Keep the table terse: one line per row, item then class then reason. Never pad a row to sound thorough. Never compress a safety warning or an irreversible-action callout.
