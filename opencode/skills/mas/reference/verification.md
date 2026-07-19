# GATE
```
Project build verification and linting must both exit 0 (e.g., tsc --noEmit for TypeScript, cargo check for Rust, pytest for Python).
```
- FAIL → spawn fixer (max 2) → still fail → ESCALATE
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
| Difficulty | Analysis Steps | Implementers | Verifiers |
|------------|----------------|--------------|-----------|
| SIMPLE | 1 | 1 | 0 (satisficing only) |
| MEDIUM | 2 | 1-2 | 1 (if confidence < 0.8) |
| COMPLEX | Full discovery + decomposition pipeline | Per schedule | Full GATE |

The meta-cognition gate runs once at task ingestion. It does NOT replace the standard discovery/decomposition pipeline — it selects the pipeline depth. A COMPLEX classification forces evidence-gated decomposition (Lever 1). A SIMPLE classification may skip discovery and go direct to implementer if C_total < 0.25 (fast lane).

# Verification Loop
```
implementer → build+lint GATE
  ├─ PASS → compute soft confidence (framing) → HITL
  └─ FAIL → fixer (max 2) → still fail → ESCALATE
     (no confidence computed while gate failing)
```

# Soft Confidence (Post-Gate, Framing Only)
```
soft_confidence = (C_cit + C_gj) / 2
  C_cit = cited_changes / total_changes
  C_gj  = 1 - (unmatched_hunks / total_hunks)
```
Where `unmatched_hunks` = diff hunks in the output that don't correspond to any requirement, and `total_hunks` = total diff hunks.
If no hunks exist (total_hunks = 0), then C_gj = 1.0 (no diff = no integrity concern).
| Score | Level | Framing |
|-------|-------|---------|
| >= 0.80 | HIGH | No caveats |
| 0.50-0.80 | MEDIUM | "Verify the following areas" |
| < 0.50 | LOW | Flag low citation coverage |

NEVER affects ship/no-ship — gate already passed.

# Graduated Verdicts

The GATE produces a binary pass/fail (project build verification and linting (determined by tech stack) exit 0). However, the verifier agent may return a graduated verdict for HITL framing:

| Verdict | Condition | Action |
|---------|-----------|--------|
| PASS | All requirements covered, C_soft >= 0.80, no structural issues | Ship normally |
| CONDITIONAL | All requirements covered, C_soft < 0.80, or minor semantic concerns | Ship with caveats in HITL |
| REJECT | Requirements missing, C_soft < 0.50, or structural failures | Do not ship — escalate |

Rule: Only binary GATE (project build verification + linting) blocks shipping. Graduated verdicts are advisory for HITL framing.

# Satisficing Gate (post-output confidence check)

After each implementer output, compute soft confidence (formula above). Apply the gate:

| Confidence | Action |
|------------|--------|
| > 0.80 | Ship — skip remaining verification steps |
| 0.50 - 0.80 | Run 1 verifier pass, then re-check confidence |
| < 0.50 | Run full verification pipeline (GATE + semantic + citation quality) |

The satisficing gate is the bridge between soft confidence computation and HITL presentation. It decides how much additional verification is warranted before presenting to the user.

Rule: Satisficing never overrides the binary GATE. If GATE fails and confidence is 0.90, GATE still blocks. Satisficing gates only downstream verification effort, not the ship/no-ship decision.

# Semantic Gate (Layer 2)

After the binary GATE passes, the verifier agent performs a semantic check:

1. Map every requirement to a specific diff hunk (file:line range)
2. Any requirement with NO matching hunk → flagged as BLOCKED in HITL
3. Requirements-to-hunks mapping is surfaced in the HITL presentation

This does NOT block shipping — only binary GATE blocks. But it prevents "GATE passes but output doesn't match requirements" (see SKILL.md Failure #3).

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

# Task Confidence Rollup (framing only — GATE is sole authority)
C_workflow = (1/N)*sum(C_i). >=0.80 HIGH, 0.50-0.80 MEDIUM, <0.50 LOW. Any UNRESOLVABLE → BLOCKED.

# TECA Overthink Detection (during-execution monitoring)

TECA (Token Entropy Consumption Analysis) detects when an agent is generating many tokens without increasing information content — a documented failure mode in long-horizon LLM planning.

## Detection Rule
Track token output in rolling windows of 200 tokens:
1. Compute token-type entropy for each window: `H_window = -Σ p(t) · log₂ p(t)`
2. If entropy remains flat (< 2% variance) for > 50% of the total budget (max_tokens of the spawned agent), signal OVERHEAT.
3. On OVERHEAT signal, the orchestrator may:
   - Terminate the current agent spawn (interrupt)
   - Stash the partial output
   - Route to a new, more focused agent with tighter scope

## Implementation
The orchestrator reads the `usage` field from the agent response when available. If `usage.completion_tokens` exceeds 50% of `max_tokens` and the agent has not produced a final output (no `=== DONE ===` signal), the orchestrator may pre-terminate and re-route.

## Thresholds
| Budget exhausted | Entropy variance | Action |
|-----------------|-----------------|--------|
| < 50% | Any | Continue normally |
| 50-75% | < 2% flat | Flag as WARM — prepare interrupt |
| > 75% | < 2% flat | Interrupt + re-route with tighter scope |

If `usage.completion_tokens` is unavailable from the agent, TECA degrades gracefully to a wall-clock heuristic (time elapsed > 2× expected completion time for difficulty class).
