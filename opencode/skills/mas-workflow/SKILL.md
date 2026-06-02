---
name: mas-workflow
description: Dynamic workflow patterns. Fan-out task decomposition, per-task pipeline (implementer→verifiers→fixer→edge-judge), fan-in AST aggregation, global integrity judgment, dynamic re-spin protocol (max 2/lane). Confidence scoring. Loaded by orchestrators and task coordinators.
---

## Architecture

```
Orchestrator(ship) → kicks off N tasks → N×TaskCoordinator
  Each: Imp → VerA + VerB → Fixer → Edge Judge (APPROVED|REJECTED→re-spin)
  All N APPROVED → AST Aggregator → Global Judge → mas-decision → HITL
```

---

## Pattern 1: Task Decomposition (Fan-Out)

### When to Decompose
| Condition | By | Example |
|---|---|---|
| >10 files | File cluster | "domain layer, infra layer" |
| Multiple independent concerns | Concern | "error handling, concurrency" |
| Multiple services/modules | Service boundary | "UserService, OrderService" |
| Refactoring across codebase | Directory/package | "src/auth, src/billing" |
| Multiple UI components | Component tree | "Header+Nav, Forms" |

### Rules
- **Independence**: Tasks MUST NOT modify same files. If overlap → merge or split by line ranges.
- **Granularity**: 1-5 files ideal, max 10 per task.
- **Ordering**: If B depends on A → sequential (A→wait→B), not parallel.

### Task Definition
```
| task_id | scope | objective | constraints | dependencies | expected_output |
```

---

## Pattern 2: Per-Task Pipeline

### Stage 1: Implementer
Minimal changes within scope. Include `file:line` citations for every change. Output → verifiers.

### Stage 2: Verifiers (×2)
| Check | What |
|---|---|
| Correctness | Solves the task? Right place? Breaks existing behavior? |
| Boundaries | Limited to task scope? Files outside untouched? |
| Citations | Every file:line claim exists and matches described change? |
| Quality | Domain conventions? Anti-patterns? |
| Minimality | Smallest change that solves the task? |

Output:
```
## Verification Report | [task_id]
### Issues Found | #|Issue|Location|Severity|Confidence|Blocking?|
### Positive Findings | #|Finding|Confidence|
### Verdict | NEEDS_FIXES / LOOKS_GOOD / UNCERTAIN | Confidence: HIGH/MED/LOW
```

### Stage 3: Fixer
Receives: implementer output + both verifier reports + task definition. Fixes all BLOCKING issues. Address non-blocking if safe. Never silently expand scope.

Output:
```
## Fixer Report | [task_id]
### Fixes Applied | #|Issue|Verifier|Fix|Location|
### Disagreements Resolved | #|V1|V2|Resolution|
### Scope Compliance | YES/NO
### Final Output | [corrected implementation]
```

If fixer made significant changes → re-verify with ≥1 verifier before proceeding.

### Stage 4: Edge Judge (Layer 2)
After fixer produces output, spawn `edge-judge`. Checks: SYNTAX_ERROR, SCOPE_ESCAPE, DATA_HOLLOWING.

Output (JSON):
```
{"verdict":"APPROVED|REJECTED","early_abort_triggered":true|false,"fault_vector":{"severity":"NONE|LOW|CRITICAL","anomaly_type":"NONE|SYNTAX_ERROR|SCOPE_ESCAPE|DATA_HOLLOWING","description":"feedback for re-spin"},"checks_run":{"syntax_compliance":"PASS|FAIL","data_hollowing":"PASS|FAIL","scope_escape":"PASS|FAIL"}}
```

#### Dynamic Re-Spin
`early_abort_triggered: true` → discard lane, pass `fault_vector.description` as hard constraint to fresh fixer, new lane_id. Other lanes unaffected. **Max 2 re-spins per lane**. 3rd → escalate orchestrator.

Only APPROVED patches flow to AST Aggregator.

---

## Pattern 3: Fan-In (Aggregation + Judgment)

### Stage 1: Collect APPROVED
Orchestrator collects all Edge-Judge-APPROVED patches from all N coordinators.

### Stage 2: AST Aggregator (Layer 3)
Spawn `ast-aggregator` with N approved patches. Builds dependency matrix, detects collisions (LINE_OVERLAP, VARIABLE_COLLISION, IMPORT_CONFLICT, SIGNATURE_DIVERGENCE, PATTERN_INCONSISTENCY, ORDERING_VIOLATION), resolves by interface integrity priority.

If unresolvable → ISOLATES conflicting branches, returns PARTIAL_CONFLICT → orchestrator spawns conflict-resolution worker.

### Stage 3: Global Judge (Layer 4)
Spawn `global-judge` with consolidated patch + original instruction set. Cross-references every requirement to a mutation. Computes integrity score.

Output:
```
{"verdict":"APPROVED|APPROVED_WITH_NOTES|NEEDS_REMEDIATION","integrity_score":0-100,"integrity_level":"FULL_INTEGRITY|MINOR_GAPS|SIGNIFICANT_GAPS|CORRUPTED","coverage":{"total":N,"covered":N,"missing":0},"mutations":{"total":N,"justified":N,"derived":N,"unplanned":0},"regression_vectors":[],"remediation":{"blocking_issues":[],"non_blocking_issues":[],"recommended_action":""}}
```

Only APPROVED/APPROVED_WITH_NOTES → mas-decision.

### Stage 4: Cross-Task Conflict Detection
| Type | Resolution |
|---|---|
| Same file by 2+ tasks | ESCALATE (violates independence) |
| Inconsistent patterns | FLAG architect review |
| Missing integration | GAP → follow-up task |
| Boundary drift | ESCALATE |

### Aggregation Table
```
| Task | Status | Edge Judge | AST Merge | Global Judge | Confidence | Cross-Task Issues |
```

### Confidence Scoring
| Condition | Score |
|---|---|
| Implementer citations valid | +1 |
| Both verifiers agree (positive) | +2 |
| Both verifiers agree (negative fixed) | +1 |
| Edge Judge APPROVED first pass | +2 |
| Edge Judge APPROVED after 1 re-spin | +0 |
| Edge Judge APPROVED after 2 re-spins | -1 |
| AST Aggregator MERGED no conflict | +2 |
| AST Aggregator MERGED with auto-resolve | +0 |
| Global Judge FULL_INTEGRITY | +3 |
| Global Judge APPROVED_WITH_NOTES | -1 |
| Verifiers disagree | -1 |
| Fixer scope expansion | -2 |

High ≥6 | Medium 3-5 | Low ≤2 → ESCALATE

---

## Pattern 4: Task Coordinator (N > 10)

Manages subset of tasks. Runs per-task pipeline (implementer→verifiers→fixer→edge judge) for each. Aggregates subset. Reports to orchestrator.

Use when: N > 10, multi-domain, or context budget concerns.

---

## Context Budget

| Agents Spawned | Action |
|---|---|
| <20 | Normal |
| 20-50 | Prefer coordinators. Write per-task state. |
| 50-100 | Batch max 10 parallel. Warn user. |
| >100 | Require user confirmation |

| Strategy | Implementation |
|---|---|
| Task isolation | Each agent sees only its task definition |
| Checkpointing | `.opencode/tasks/[task_id].md` |
| Streaming | Aggregate as tasks complete |
| Batched fan-out | Batch of 10 → aggregate → next batch |
| Early termination | Systemic issue → abort remaining |

---

## Decision: Linear vs Dynamic

| Use Linear | Use Dynamic |
|---|---|
| <5 files | >10 files or multiple modules |
| Single concern | Multiple independent concerns |
| High coupling | Changes isolatable by boundary |
| Context tight | Context healthy |

2+ right-column conditions → dynamic.

---

## Anti-Patterns

| Mistake | Fix |
|---|---|
| Decompose tightly-coupled change | Keep linear |
| 1 verifier | Always 2 |
| Fixer silently expands scope | Flag scope expansion |
| No cross-task checks | Run conflict detection |
| Spawn 100+ at once | Batch 10, use coordinators |
| No per-task checkpoint | Write `.opencode/tasks/[id].md` |
| Skip Edge Judge | Run after fixer before aggregation |
| Proceed with REJECTED Edge Judge | Enforce AUTO-ABORT |
| Manual diff concat without AST Aggregator | Use AST Aggregator |
| Skip Global Judge | Cross-reference instruction set |
| >2 re-spins per lane | Cap at 2, escalate 3rd |
| Worker >4K tokens | Dehydrate before spawn |
