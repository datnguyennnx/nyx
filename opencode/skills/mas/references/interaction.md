# Meta-Cognitive Assessment
- Difficulty: verification.md § Difficulty Assessment (canonical — lazy ref, load on need).

## Delegation Threshold Calibration
Delegation gate: decomposition.md § Delegation Gate (canonical). Selective delegation → 23% fewer tool + 27% fewer search failures, no quality regression (GitHub Blog, Jun 2026).

# Silence-First Supervision
Supervise by exception. Do not narrate between checked batches: speak only to (a) batch stop (GATE fail), (b) escalation boundary, (c) user handoff. Steer all three with ≤ 3 sentences each; otherwise stay silent and let the batch run. No mid-pipeline question yield (R-1): batch stop and escalation auto-cycle in the same turn — classify → re-spawn with corrected instructions while budget remains, else emit FAILED Auto Report same turn. Every batch stop / escalation / handoff message MUST chain its tool call same turn — subagent re-spawn or FAILED Auto Report envelope — never bare text alone (R-1). Budgets and silence-first are unchanged.

# Feedback Classification
| Pattern | Re-entry Action |
|---|---|
| Approach change | Orchestrator redesigns, passes to implementer |
| Implementation redo | Re-spawn implementer for affected files |
| Verification add | Orchestrator adds new check to requirements |
| Scope change / Feature add | Re-decompose with new scope |
| Decision override | Re-decompose with corrected approach |

# Loop Guardrails — Iteration Budget with Verifier Gate
- Budget: 3 loops per decision context, tier-scaled (SIMPLE 1, MEDIUM 3, COMPLEX/CROSS-CUTTING 5); each loop consumes one unit.
- Each unit gated by the auto verifier gate (maker-checker): checker re-validates output vs requirements + binary GATE before next re-spawn. No HITL needed while budget remains — auto-cycle in the same turn, never ASK mid-pipeline (R-1).
- Exhausted → FAILED Auto Report in the same turn (R-2): halt the loop, emit `FAIL` with JSON {files:[], hunks:[{file,range,change}], verification:{build,lint}} covering completed vs unmatched sub-intents, preserve history, flag scope creep. No `!continue` wait, no question yield.
- Assertion weakening is NEVER a budget item: freezes the loop immediately.

# Human Handoff
ASK is pre-ladder only (R-2): gated to pre-ladder unclear only — ambiguous request with no sub-intent ledger yet and no spawn attempted. Once the ladder starts (Inventory → Classify → Decompose or any spawn), never ASK — auto-cycle while budget remains, else FAILED Auto Report same turn (lazy: § FAILED Auto Report).
- Uncertainty > 0.7 AND steps < 3 AND no spawn yet → spawn discoverer/analysis agent first; ASK only if the request itself is uninterpretable pre-ladder.
- Uncertainty > 0.7 AND steps ≥ 3 → never ASK mid-pipeline: re-classify → re-spawn with corrected instructions; on exhaustion emit FAILED Auto Report same turn (see § FAILED Auto Report).
- Uncertainty < 0.3 → proceed (satisficing).
- Steps counter: each spawn increments it for the decision context; resets on decision.

# FAILED Auto Report
On budget exhaustion, GATE FAIL with no budget left, or frozen assertion-weakening halt, emit in the same turn (R-2): `FAIL` + JSON {files:[], hunks:[{file,range,change}], verification:{build:PASS/FAIL,lint:PASS/FAIL}} + budget log + unmatched sub-intents + first FAIL evidence. Never yield a question, never wait.

# Assertion Weakening Detection
1. Diff build-config against baseline captured before first attempt after every implementer re-spawn.
2. Any relaxation (strict → false, noUnusedLocals → false, eslint error → warn) → halt immediately.
3. Do NOT auto-retry. Write-lock pipeline, present diff, auto-escalate. No user signal required or permitted to unfreeze.

# Re-spawn Diversity Strategy
| Budget unit | Strategy | Reasoning |
|---------|----------|-----------|
| 1 | Error output + narrowed file scope | Simple errors |
| 2 | Discovery findings + research (broader context) | Missing imports, interface changes |
| 3 (final) | Verifier-gate FAIL at boundary → FAILED Auto Report same turn | Budget exhausted |

Before each re-spawn: if overthinking caused the failure (diagnosis.md § Failure: Overthinking causes wrong output despite correct initial approach), fix with narrower scope, not more context.