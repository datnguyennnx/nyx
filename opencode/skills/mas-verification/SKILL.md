---
name: mas-verification
description: Build/lint verification, citation quality, ship confidence, conflict detection. For ship-mas orchestrator.
---

# GATE (Binary — Evaluated First, Never Averaged)
```
tsc --noEmit && eslint must both exit 0.
```
- FAIL → spawn fixer (max 2) → still fail → ESCALATE
- NEVER average with other signals. A failing gate ALWAYS blocks shipping regardless of citation quality or diff integrity.
- While gate is failing, do NOT compute or display any confidence score. Soft confidence is computed ONLY after gate passes, and only for framing (never affects ship/no-ship).

## Priority
1. `tsc --noEmit` — BLOCKING (part of GATE)
2. `eslint` — BLOCKING (part of GATE)
3. Domain checks (conventions, anti-patterns) — NON-BLOCKING unless crash/data-loss/API-break

Gate PASS → proceed to soft confidence. Domain violations = feedback, not gates.

# Verification Loop
```
implementer → tsc+eslint GATE
  ├─ PASS → compute soft confidence (framing) → HITL
  └─ FAIL → fixer (max 2) → still fail → ESCALATE
     (no confidence computed while gate failing)
```

# Soft Confidence (Post-Gate, Framing Only)
```
soft_confidence = (C_cit + C_gj) / 2
  C_cit = cited_changes / total_changes
  C_gj  = git diff integrity / 100
```
| Score | Level | Framing |
|-------|-------|---------|
| >= 0.80 | HIGH | No caveats |
| 0.50-0.80 | MEDIUM | "Verify the following areas" |
| < 0.50 | LOW | Flag low citation coverage |

NEVER affects ship/no-ship — gate already passed.

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
