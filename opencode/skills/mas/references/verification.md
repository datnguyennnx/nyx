# Gate — exit-0 proven

Build must exit 0 (tsc --noEmit, cargo check, pytest). Lint exit 0 preferred, advisory only. NEVER average signals; failing build blocks ship.
https://www.anthropic.com/engineering/building-effective-agents

# Envelopes (bounded, default shape)

PASS: `{"status":"PASS","coverage":{"cited":2,"total":2}}` ≤50 tokens, no logs.
Coverage: `R-1 → file.ts:12-34` one line per requirement; `R-3 → FAILED` triggers re-spawn.
FAIL: `{"status":"FAIL","unit":"task-3","raw":{"build":"<tail ≤20 lines>"}}` ≤300 tokens, tail only.

# Maker-Checker — proven

Maker (implementer) produces hunks; maker PASS never accepted. Checker re-runs build+lint adversarially (attempt to REFUTE), maps requirements→hunks, one envelope per budget unit.
https://nhimg.org/glossary/maker-checker-split

# Generator-Evaluator — proven

Sample-evaluate loop: generator proposes, evaluator grades binary gate; iterate within budget, ship best PASS.
https://www.anthropic.com/engineering/harness-design-long-running-apps

# Retry Budget (cap)

| Tier | Budget |
|---|---|
| SIMPLE ≤2 files | 1 |
| MEDIUM 3-5 files | 3 |
| COMPLEX >5 files | 5 |
| CROSS-CUTTING | 5 |

Exhaustion → escalation boundary, FAILED envelope as artifact. Collapsed all-failed batch burns ONE unit; re-enter as ONE unit. Independent failures (disjoint files+errors, proven) cycle singly.

Budget counter: orchestrator states Budget N remaining in each Level message; each re-spawn decrements one unit, verifier-gated (see Gate above).

# Semantic Gate (Layer 2)

After exit-0: map every requirement → hunk. Unmatched → FAILED + auto re-spawn same turn; re-scope before re-spawn; exhaustion → escalation. Never present partial coverage.

# Overflow (canonical)

PARTIAL = valid-subset + `remaining:N`, priority-first, never cut mid-pair (requirement↔hunk together). Missing PARTIAL → REMAINING bounded pull, verifier-gated (see Gate). Cited == declared scope; backstops stay.

# Conflict Source

Canonical: `references/decomposition.md` edge taxonomy + writer safety. Never adjudicate from task list alone — require file:line.
