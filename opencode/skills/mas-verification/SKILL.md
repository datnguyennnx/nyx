---
name: mas-verification
description: "Reference for binary GATE, meta-cognition, soft confidence, semantic verification, and TECA overthink detection in ship-mas orchestration."
---
# GATE
```
Project build verification and linting must both exit 0 (e.g., tsc --noEmit for TypeScript, cargo check for Rust, pytest for Python).
```
- FAIL → re-spawn implementer with corrected instructions (max 3) → still fail → ESCALATE
- NEVER average with other signals. A failing gate ALWAYS blocks shipping regardless of citation quality or diff integrity.
- While gate is failing, do NOT compute or display any confidence score. Soft confidence is computed ONLY after gate passes, and only for framing (never affects ship/no-ship).

## Priority
1. Build verification — BLOCKING (part of GATE)
2. Linting — BLOCKING (part of GATE)
3. Domain checks (conventions, anti-patterns) — NON-BLOCKING unless crash/data-loss/API-break

Gate PASS → proceed to soft confidence. Domain violations = feedback, not gates.

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

The meta-cognition gate runs once at task ingestion. It does NOT replace the standard discovery/decomposition pipeline — it selects the pipeline depth. A COMPLEX classification forces evidence-gated decomposition (Lever 1). A SIMPLE classification may skip discovery and go direct to implementer if C_total < 0.25 (fast lane).

# Verification Loop
```
implementer → build+lint GATE
  ├─ PASS → compute soft confidence (framing) → HITL
  └─ FAIL → re-spawn implementer with corrected instructions → ESCALATE
     (no confidence computed while gate failing)
```

# Soft Confidence (post-GATE framing only — never affects ship/no-ship)
```
soft_confidence = (cited_changes/total_changes + matched_hunks/total_hunks) / 2
>= 0.80 → HIGH (no caveats)
0.50-0.80 → MEDIUM ("verify these areas")
< 0.50 → LOW (flag low citation coverage)
```

# Satisficing Gate (post-GATE confidence check)
```
> 0.80 → ship, skip remaining verification
0.50-0.80 → orchestrator checks output against requirements
< 0.50 → run full verification pipeline
Never overrides the binary GATE.
```

# Efficiency Metrics

After each GATE pass, compute and report:

## Token Efficiency
`token_efficiency = passed_steps / total_thinking_tokens (est.)`

## Delegation Efficiency  
`delegation_efficiency = passed_verifications / sub_agents_spawned`

## Waste Ratio
`waste_ratio = blocked_retries / total_bash_commands`

Targets: token_efficiency > 0.01, delegation_efficiency > 0.5, waste_ratio < 0.05.

Note: Token counts are estimates based on thinking block length and tier budget,
not API-level measurements. Use for trend analysis, not precise accounting.

### Corrective Actions
When targets are missed:
- delegation_efficiency < 0.5: Tighten the Delegation Gate — require 2+ YES conditions before spawning
- waste_ratio > 0.05: Pre-approve common bash commands to avoid permission-denied retries
- token_efficiency < 0.01: Reduce thinking tier by one level (Complex→Moderate, Moderate→Quick)
- All targets met: Continue with current orchestration strategy

# Semantic Gate (Layer 2)

After the binary GATE passes, the orchestrator performs a semantic check:

1. Map every requirement to a specific diff hunk (file:line range)
2. Any requirement with NO matching hunk → flagged as BLOCKED in HITL
3. Requirements-to-hunks mapping is surfaced in the HITL presentation

This does NOT block shipping — only binary GATE blocks. But it prevents "GATE passes but output doesn't match requirements" (see mas-diagnosis skill Failure #3).

# TECA Overthink Detection (Layer 3)

Before finalizing any HITL, run the TECA (Thinking Efficiency and Cognitive Assessment) check:

## Oscillation Detection
Count how many times the thinking block went back and forth between options:
- 0-1 oscillations → NORMAL
- 2-3 oscillations → WARNING — spawn discovery agent to resolve
- 4+ oscillations → OVER-THINKING — abort thinking, force delegation

## Hesitation Marker Detection
Search thinking for markers: "but wait", "actually", "hmm", "on the other hand", "let me reconsider"
- 0-2 markers → NORMAL
- 3-5 markers → WARNING — consider early stopping
- 6+ markers → OVER-THINKING detected — the answer before the first marker was likely correct
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

If TECA flags RED on any dimension, do NOT finalize HITL. Instead, spawn an agent for the remaining ambiguous decisions.

# Citation Quality
Q(c) = min(1.0, log2(c+1)), c = cited/total. c >= 0.60 → ACCEPT.
| c | Q | Action |
|---|----|--------|
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
| Pattern | Action |
|---------|--------|
| Two tasks modify same file, no dependency | Re-spawn sequentially |
| A removes import B references | Isolate or resolve |
| A changes export signature, B calls old | Isolate or resolve |
| B depends on A, A not complete | Re-order — spawn A first |

# Requirements Coverage
Every R-ID needs APPROVED diff touching acceptance_files. Missing → BLOCKED. Diff outside target_files → UNPLANNED_CHANGE.

