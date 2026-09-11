# Verification — SOLE owner (canonical)

Sole owner of Auto Report, Gate, Envelope, Token Caps, Maker-Checker, Retry Budget, Re-Spawn, Evidence, Semantic Gate, Overflow, Conflict Source, End-State. Auto Report (`Step N/7`, Step 6) IS the canonical envelope below; consumers POINT here, never restate the JSON.

# Gate — exit-0 proven

`~/.config/opencode/scripts/validate-mas.mjs` (config/skill/persona conformance) AND `~/.config/opencode/scripts/envelope-lint.mjs` (envelope validity) must BOTH exit 0, plus project build (tsc --noEmit, cargo check, pytest). Never average signals; a failing build or validator blocks ship. Judge the SINGLE canonical envelope, not per-printer impressions. Every finding carries `file:line` (files) or a URL (web); no evidence → NO_RESULTS/UNVERIFIED, never guess.

# Envelope (canonical JSON, appears once)

```json
{"status":"PASS|FAIL|PARTIAL|NO_VERIFICATION|NO_RESULTS","unit":"task-3","coverage":{"cited":2,"total":2},"raw":{"build":"<tail ≤20 lines>"},"remaining":0}
```

- PASS: coverage-only, `cited==total`, ≤50 tokens, no logs. Coverage `R-1 → file.ts:12-34` one line per requirement; `R-3 → FAILED` triggers re-spawn.
- FAIL: raw tail only, ≤300 tokens.
- PARTIAL: valid-subset + `remaining:N` (see Overflow).
- NO_VERIFICATION: no tool call / no signal — treated as FAIL for gate purposes.
- NO_RESULTS: build/lint produced no usable signal (empty, node killed) — re-run once, else escalate.

# Token Caps

| Status | Cap | Shape |
|---|---|---|
| PASS | ≤50 | coverage only |
| FAIL | ≤300 | raw tail ≤20 lines |
| PARTIAL | ≤300 | valid-subset + remaining |
| NO_VERIFICATION | ≤400 | reason |
| NO_RESULTS | <800 | summary |

# Maker-Checker — proven

Maker (implementer) produces hunks; maker PASS never accepted. Checker re-runs build+lint adversarially (attempt to REFUTE), maps requirements→hunks, one envelope per budget unit.

# Retry Budget (cap) — Re-Spawn

Retry Budget: ≤3 attempts per task, fresh spawn each. Tiers: TRIVIAL 1 / STANDARD 2 / COMPLEX 3. Each FAIL → narrowed re-spawn; max 3 attempts; depth 1 (subagents never spawn subagents). Diversity 1 error+scope, 2 discovery+context, 3 boundary → FAILED; never identical instructions. Exhaustion → FAILED envelope same turn; collapsed all-failed batch burns ONE unit; independent failures (disjoint files+errors, proven) cycle singly. Counter: orchestrator states `Budget N remaining` per `Step N/7` message; each re-spawn decrements one unit, verifier-gated (see Gate).

# Semantic Gate (Layer 2)

After exit-0: map every requirement → hunk. Unmatched → FAILED + auto re-spawn same turn; re-scope before re-spawn; exhaustion → escalation. Never present partial coverage.

# Overflow (canonical)

Over-cap output → PARTIAL = valid-subset + `remaining:N`, priority-first, never cut mid-pair (requirement↔hunk together). Missing PARTIAL → REMAINING bounded pull, verifier-gated (see Gate). Cited == declared scope; backstops stay.

# End-State / Paired Evaluation

Judge the FINAL state (the shipped envelope), scored against a no-skill baseline, not turn-by-turn progress; intermediate check-ins are informational only.

# Conflict Source

Canonical: `~/.config/opencode/skills/mas/references/decomposition.md` edge taxonomy + writer safety. Never adjudicate from task list alone — require file:line.
