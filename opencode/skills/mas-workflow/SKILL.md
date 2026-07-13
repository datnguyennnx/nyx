---
name: mas-workflow
description: Complexity scoring model and decomposition triggers for manifest generation. Conceptual definitions only — pipeline execution is handled by the TS Engine. Loaded by the task-decomposer.
---

## Fast-Lane Gate

Fast-Lane if ALL three: C(T) < 0.25 (τ threshold) AND exactly 1 task AND ≤2 output files. OR `!quick` prefix (overrides, C(T) = 0).

| Gate Result | `routing_decision` | Manifest Shape |
|---|---|---|
| Fast-Lane passes | `"fast_lane"` | 1 node, trimmed phase_chain (implement+gate), `max_respins: 0`, `edges: []`, `levels: [["N1"]]` |
| Fast-Lane fails | `"full_dag"` | Multi-node DAG, full 6-phase chain per node, `max_respins: 2`, declared edges/levels |

## Complexity Scoring (detail in `mas-complexity-scoring`)

C(T) = avg(H_norm, D_JS, I_norm) where active components only. See `mas-complexity-scoring` for formulas.

## Decomposition Triggers (when C(T) ≥ 0.25)

| Condition | Action |
|---|---|
| H_norm > 0.70 | Decompose by file cluster — each cluster a separate node |
| \|task_set\| > 1 | Honor natural task boundaries |
| I_norm > 0 | Sequential edge between tasks with mutual information |
| D_JS > 0.15 | Split by domain — backend and frontend separate nodes |

Granularity: `n_max = ⌈2^H_norm⌉ + 1` files per task. Tasks MUST NOT share files within same level — if overlap, compute I(U_j; U_k): I > 0 → sequential edge, I = 0 → parallel-safe.
