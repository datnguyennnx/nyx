# GATE
```
Project build verification and linting must both exit 0 (e.g., tsc --noEmit for TypeScript, cargo check for Rust, pytest for Python).
```
- FAIL → auto-diagnose (diagnostician, fresh context) → re-spawn implementer with corrected instructions same turn within retry_budget (default 3 per failure, tier-scaled: SIMPLE 1 / MEDIUM 3 / COMPLEX 5 / CROSS-CUTTING 5) → budget exhausted → auto-escalation boundary (structural, FAILED envelope as artifact, no presentation yield)
- NEVER average with other signals. A failing gate ALWAYS blocks shipping regardless of citation quality or diff integrity.
- While gate is failing, do NOT compute or display any confidence score. Soft confidence is computed ONLY after gate passes, and only for framing (never affects ship/no-ship).

## Priority
1. Build verification — BLOCKING (part of GATE)
2. Linting — BLOCKING (part of GATE)
3. Domain checks (conventions, anti-patterns) — NON-BLOCKING unless crash/data-loss/API-break

Gate PASS → proceed to soft confidence. Domain violations = feedback, not gates.

# Verification Envelopes (read economy — the default output shape)

All verifier/checker outputs are BOUNDED envelopes, never full dumps. Raw build/lint output is attached ONLY when status=FAIL. Envelopes are single structured blocks; prose narration is prohibited.

## Status Envelope (PASS)
```json
{"status":"PASS","coverage":{"cited":2,"total":2,"matched_hunks":2,"total_hunks":2}}
```
≤ 50 tokens. No raw logs, no annotated diff, no "everything looks good" prose.

## Coverage Envelope (semantic mapping — one line per requirement)
```
R-1 → file.ts:12-34
R-2 → file.ts:40-60
R-3 → FAILED (no matching hunk — auto re-spawn same turn)
```
Only unmatched requirements carry detail. Mapped requirements are one line each.

## Failures Envelope (FAIL — the ONLY case that carries raw data)
```json
{"status":"FAIL","unit":"task-3","coverage":{...},"raw":{"build":"<error tail ≤20 lines>","lint":"<error tail ≤10 lines>"}}
```
≤ 300 tokens. Raw data is scoped to the failing artifact: the TAIL of the error stream, never the full build log. Never attach extra files on PASS or routine FAIL — attaching evidence files for context is the diagnostician's call (diagnosis.md § Diagnostician Output Envelope), not the verifier's.

## Envelope Rules
- PASS ⇒ envelope only, file:line citations in coverage. No fixes, no suggestions.
- FAIL ⇒ envelope + raw error tail. No suggested fixes (that belongs to the diagnostician envelope).
- Every citation is file:line — Anti-Hallucination Heuristics apply to envelopes exactly as to reports.
- `tokens_saved = full_output_estimate − envelope_size` can be reported in the SUMMARY field of the spawn contract; the envelope itself stays minimal.

# Adversarial Verify Pass

The checker does NOT confirm the maker's claim. It attempts to REFUTE it. Each verify pass is an adversarial attempt on the diff under the binary GATE:
- Assume the maker's PASS claim is false until build AND lint both exit 0 on a fresh run (maker self-reports are never gate results).
- Attack surfaces: stale build artifacts, config relaxation, tests skipped, uncited hunks, requirements with no hunk.
- A verifier PASS means "could not refute within the binary gate," NOT "the diff is correct." The distinction is surfaced in the envelope: PASS states what was attempted to refute (one line), never a quality judgement.
- Refutation requires file:line evidence in the Failures Envelope. "Feels wrong" without a failing build/lint is a domain-check flag (non-blocking feedback), not a gate result.

# All-Failed-Batch Stop

If EVERY unit in a batch returns a FAIL envelope, STOP the batch as one unit:
- Do NOT cycle each failed task individually. Collapse all units sharing status + overlapping root cause into ONE Failures Envelope (cause puzzle-able from raw error tails — the collapse itself is a search-before-read pass).
- Budget: the collapsed batch burns ONE retry_budget unit, not one per task. Exhaustion → auto-escalation (structural) for the batch, with the single envelope as the escalation artifact.
- The whole batch re-enters the next cycle as ONE RETRY-NEXT-CYCLE registry entry (ship-mas Task Registry), scope = the collapsed envelope. Ladder stop rules auto re-climb same turn — no presentation yield, no manual resume gate.
- Exception: only cycles individually when the failures are provably independent (disjoint files, disjoint errors) — never assume independence to avoid budget math; prove it from the envelopes first.

# Search-Before-Read Windows (investigation read economy)

- Prefer grep/glob over read. NEVER open a file until a search has named BOTH the file and the region.
- Initial read window ≤ 100 lines around the search hit. Widen only if the evidence inside the window demands it.
- Full-file dumps are exceptional: attached into a Failures Envelope only when a diagnosis needs the raw context, never for routine verification.
- Read windows count against the envelope token budget when attached.

# Meta-Cognition Gate (pre-execution assessment)

Before any agent spawn, assess the task to allocate the correct pipeline depth. This prevents over-investment in simple tasks and under-investment in complex ones.

## Difficulty Assessment
| Classification | Criteria |
|----------------|----------|
| SIMPLE | ≤2 target files AND ≤1 dependency AND description < 200 chars |
| MEDIUM | 3-5 target files OR 2-3 dependencies OR description 200-500 chars |
| COMPLEX | >5 target files OR >3 dependencies OR description >500 chars OR cross-domain |

## Token Budget Allocation
| Difficulty | Analysis Steps | Implementers | Verifiers | Thinking Tier |
|------------|----------------|--------------|-----------|---------------|
| SIMPLE | 1 | 1 | 0 (satisficing only) | Quick (500 tokens) |
| MEDIUM | 2 | 1-2 | 1 (if confidence < 0.8) | Moderate (2K tokens) |
| COMPLEX | Full discovery + decomposition pipeline | Per schedule | Full GATE | Complex (5K tokens) |
| CROSS-CUTTING | Multi-level decomposition + research | Per schedule | Full GATE + TECA | Deep (8K tokens) |

**Hard cap**: 12,000 tokens per thinking block. Note: overthinking effects are
cumulative across blocks (Zhou et al. 2026 measured per-task, not per-block).
If you use multiple blocks totaling >12K tokens in a single Ladder step, you
may still experience overthinking effects despite each block being under the cap.
Prefer one focused block over multiple smaller ones.

The meta-cognition gate runs once at task ingestion. It does NOT replace the standard discovery/decomposition pipeline — it selects the pipeline depth. A COMPLEX classification forces evidence-gated decomposition (Lever 1). A SIMPLE classification may skip discovery and go direct to implementer when C_total is in the fast-lane band (decomposition.md § Complexity Score).

# Verification Loop (maker-checker, budget-gated)

Retry logic lives in interaction.md (§ Re-spawn Diversity Strategy); budget and gate rules follow.

## Maker-Checker Split
- **Maker** (implementer) produces diff hunks. The maker's own PASS claim is never accepted as a gate result.
- **Checker** (verifier) independently re-runs build + lint (binary GATE) as an ADVERSAIAL verify pass (§ above), maps requirements→hunks, and returns one verification envelope per budget unit.
- Verifier-gate PASS with budget remaining → continue (accept, or reduce pipeline depth). Any verifier-gate FAIL consumes one unit of retry_budget.

## Retry Budget
| Tier | retry_budget per failure |
|---|---|
| SIMPLE | 1 |
| MEDIUM | 3 |
| COMPLEX | 5 |
| CROSS-CUTTING | 5 |

Budget exhaustion → auto-escalation boundary (structural escalation; no further auto-retry, no mid-loop pause). TECA RED flags consume a budget unit for a scoped diagnostician spawn instead of finalizing. Full-batch FAILs collapse to one unit (§ All-Failed-Batch Stop).

# Soft Confidence (post-GATE framing only — never affects ship/no-ship)
```
soft_confidence = (cited_changes/total_changes + matched_hunks/total_hunks) / 2
>= 0.80 → HIGH (no caveats)
0.50-0.80 → MEDIUM ("verify these areas")
< 0.50 → LOW (flag low citation coverage)
```
Computed from the coverage envelope fields only — no re-reading of diffs.

# Satisficing Gate (post-GATE confidence check)
```
> 0.80 → ship, skip remaining verification
0.50-0.80 → orchestrator checks output against requirements
< 0.50 → run full verification pipeline
Never overrides the binary GATE.
```

# Semantic Gate (Layer 2)

After the binary GATE passes, the orchestrator performs a semantic check:

1. Map every requirement to a specific diff hunk (file:line range) — emit the Coverage Envelope
2. Any requirement with NO matching hunk → emit FAILED Coverage Envelope same turn + auto re-spawn implementer (diagnostician → implementer per Re-spawn Diversity Strategy) within retry_budget; budget exhausted → auto-escalation boundary with FAILED envelope as artifact. Never yield to presentation.
3. Requirements-to-hunks mapping is emitted as the Coverage Envelope (not a prose table) and feeds the auto re-spawn scope directly.

Binary GATE (build + lint exit 0) still alone decides ship/no-ship; semantic FAILED is an auto re-spawn trigger with WARNING-flavored envelope detail, never a presentation pause. This prevents "GATE passes but output doesn't match requirements" (diagnosis.md #1).

# TECA Overthink Detection (Layer 3)

TECA is an **internal orchestration protocol** — a heuristic self-check on the orchestrator's thinking block, not a validated psychometric instrument. Marker thresholds below are tuned for ship-mas orchestration, not externally published science. The only externally cited indicators in this skill are the Zhou et al. 2026 findings: overthinking effects cumulative across blocks (Meta-Cognition Gate) and the 67.5% negative-flip rate (hesitation markers below).

Before emitting any PASS/FAILED envelope, run the TECA (Thinking Efficiency and Cognitive Assessment) check:

## Oscillation Detection
Count how many times the thinking block went back and forth between options (canonical thresholds below):
- 0-1 oscillations → NORMAL — continue
- 2-3 oscillations → WARNING — spawn a discoverer or diagnostician scoped to the ambiguity, then resume using its output
- 4+ oscillations → OVER-THINKING — commit to the decision that existed immediately before the first marker; stop deliberating

## Hesitation Marker Detection
Search thinking for markers: "but wait", "actually", "hmm", "on the other hand", "let me reconsider"
- 0-1 markers → NORMAL
- 2-3 markers → WARNING — spawn a discoverer or diagnostician scoped to the ambiguity
- 4+ markers → OVER-THINKING detected — the answer before the first marker was likely correct
  (Zhou et al. 2026: 67.5% of negative flips — cases where the final answer is
  wrong AND differs from the initial answer — involved abandoning correct initial
  answers. This does NOT mean all early answers are correct — only that when the
  answer changes from right to wrong, the first answer was likely correct. Use
  oscillation markers as a warning sign, not a guarantee.)

## Budget Compliance
Check which tier was allocated (Quick 500 / Moderate 2K / Complex 5K / Deep 8K / Hard 12K):
- Within budget → GREEN
- Exceeded budget by <50% → YELLOW — acceptable for complex tasks
- Exceeded budget by 50%+ → RED — overthinking, restructure as spawn prompt

If TECA flags RED on any dimension, do NOT emit PASS. Instead, auto re-spawn an agent same turn for the remaining ambiguous decisions (consumes one retry_budget unit; exhaustion → auto-escalation boundary).

# Citation Quality
Q(c) = min(1.0, log2(c+1)), c = cited/total. c >= 0.60 → ACCEPT.
| c | Q | Action |
|----|-----|--------|
| 0.00 | 0.00 | REJECT |
| 0.50 | 0.58 | MARGINAL |
| 0.60 | 0.68 | ACCEPT |
| 1.00 | 1.00 | FULL_TRUST |

# Anti-Hallucination Heuristics
| Indicator | Confidence |
|-----------|------------|
| No file:line citations | LOW |
| All citations same line | LOW |
| Cites files outside target_files | LOW |
| Finding contradicts diff | LOW |
| Direct file:line per claim | HIGH |

# Conflict Detection (parallel tasks)
Canonical handling lives in decomposition.md: § Edge Taxonomy — 3 Levels (P-BLOCKING / P-PARALLEL / P-WRITE scheduling), § Concurrent-Writer Safety (same-file writes), § False-Independence Anti-Patterns (shared types, migrations, interfaces). The complexity-score script enforces file-overlap and cycle detection — never adjudicate parallel conflicts from the task list alone.

# Requirements Coverage
Every R-ID needs APPROVED diff touching acceptance_files. Missing → FAILED envelope + auto re-spawn same turn within retry_budget; exhaustion → auto-escalation boundary. Diff outside target_files → UNPLANNED_CHANGE. Coverage is delivered as the Coverage Envelope, one line per R-ID.