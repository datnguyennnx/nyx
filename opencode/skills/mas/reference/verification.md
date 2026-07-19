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
