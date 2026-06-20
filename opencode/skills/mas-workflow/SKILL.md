---
name: mas-workflow
description: Dynamic workflow patterns — entropy-driven decomposition, per-task pipeline
(implementer→verifiers→fixer→edge-judge), fan-in aggregation, re-spin (max 2/lane),
formal confidence scoring. Loaded by orchestrators and task coordinators.
---

## Pattern 1: Task Decomposition (Fan-Out)

### Trigger (entropy-driven, per `mas-complexity-scoring`)

| Condition | Action |
|---|---|
| H_norm > 0.70 | Decompose by file cluster |
| \|task_set\| > 1 | Pre-decomposed — honor it |
| I_norm > 0 | Isolate at service boundary |
| D_JS > 0.15 | Split by domain |

### Granularity

```
n_max = ⌈2^{H_norm}⌉ + 1 files per task
```

| H_norm | n_max |
|---|---|
| 0 | 2 |
| 0.5 | 3 |
| 1.0 | 4 |

### Independence

Tasks MUST NOT share files. Overlap → compute I(U_j; U_k). I > 0 → sequential. I = 0 → parallel.

## Pattern 2: Per-Task Pipeline

### Implementer → Verifiers (×2) → Fixer → Edge Judge

| Stage | Checks |
|---|---|
| Implementer | Minimal changes, `file:line` citations, output to verifiers |
| Verifier ×2 | Correctness, boundaries, citations, quality, minimality |
| Fixer | Fix all BLOCKING. Non-blocking if safe. Never expand scope. |
| Edge Judge | SYNTAX_ERROR, SCOPE_ESCAPE, DATA_HOLLOWING |

Verifier output: issues table + verdict (NEEDS_FIXES/LOOKS_GOOD/UNCERTAIN).

Fixer output: fixes applied, disagreements resolved, scope compliance, corrected implementation.

Edge Judge output (JSON):
```json
{"verdict":"APPROVED|REJECTED","early_abort_triggered":true|false,"fault_vector":{"severity":"NONE|LOW|CRITICAL","anomaly_type":"NONE|SYNTAX_ERROR|SCOPE_ESCAPE|DATA_HOLLOWING","description":"..."},"checks_run":{"syntax_compliance":"PASS|FAIL","data_hollowing":"PASS|FAIL","scope_escape":"PASS|FAIL"}}
```

### Re-spin

`early_abort_triggered: true` → discard, pass fault_vector to fresh fixer. Max 2 per lane. 3rd → escalate.

Only APPROVED → AST Aggregator.

## Pattern 3: Fan-In (Aggregation + Judgment)

1. Collect all Edge-Judge-APPROVED patches
2. AST Aggregator: dependency matrix, collision detection → consolidated patch
3. Global Judge: cross-reference requirements → integrity score → APPROVED/APPROVED_WITH_NOTES/NEEDS_REMEDIATION
4. Only APPROVED/APPROVED_WITH_NOTES → `mas-decision`

Global Judge output:
```json
{"verdict":"APPROVED|APPROVED_WITH_NOTES|NEEDS_REMEDIATION","integrity_score":0-100,"integrity_level":"FULL_INTEGRITY|MINOR_GAPS|SIGNIFICANT_GAPS|CORRUPTED","coverage":{"total":N,"covered":N,"missing":0},"mutations":{"total":N,"justified":N,"derived":N,"unplanned":0},"regression_vectors":[],"remediation":{"blocking_issues":[],"non_blocking_issues":[],"recommended_action":""}}
```

### Cross-Task Conflict Detection

| Type | Resolution |
|---|---|
| Same file by 2+ tasks | ESCALATE |
| Inconsistent patterns | FLAG architect |
| Missing integration | GAP → follow-up task |
| Boundary drift | ESCALATE |

## Confidence Scoring

```
C = α·C_cit + β·C_ver + γ·C_edge + δ·C_gj
α = β = γ = δ = 0.25
```

| Signal | Source | Formula | Range |
|---|---|---|---|
| C_cit | verifier | `cited_changes / total_changes` | [0,1] |
| C_ver | verifiers | 1.0 both PASS, 0.5 mixed, 0.0 both FAIL | [0,1] |
| C_edge | edge-judge | 1.0 first pass, 0.5 1 re-spin, 0.0 2 re-spins | [0,1] |
| C_gj | global-judge | `integrity_score / 100` | [0,1] |

Inapplicable component → `w_i = 1/k` where k = active components.

| C Range | Level |
|---|---|
| ≥ 0.80 | HIGH |
| 0.50 – 0.80 | MEDIUM |
| < 0.50 | LOW → escalate |

## Pipeline Mode Selection

Determined by C(T) from `mas-complexity-scoring`:

| C(T) | Mode |
|---|---|
| < 0.25 | Linear |
| 0.25 – 0.60 | Hybrid |
| ≥ 0.60 | Dynamic |
