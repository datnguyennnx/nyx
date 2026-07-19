# Topology
L0: ship-mas = classify, decompose, spawn, verify, HITL
L1: Generic agents (discovery, architect, implementer, fixer, verifier) = direct tool access, domain skills via `skill` tool

# Atomic Split
Each task: one file cluster, one scope, zero overlap with parallel tasks. Coupled changes → abstract interface first (architect), then sequential spawn.

# Complexity Scoring — DETERMINISTIC ONLY (no mental arithmetic)
```
bash: node ~/.config/opencode/scripts/complexity-score.mjs --input '<json>'
```
Script stdout (`H_norm`, `D_JS`, `I_norm_coupling_proxy`, `C_T`, `routing`, `levels`) is AUTHORITATIVE. If script throws (no evidence on coupling/edge), go back to discovery — never estimate.

`I_norm` is `I_norm_coupling_proxy` — evidence-weighted heuristic, NOT Shannon mutual information. Use this name, not "mutual information."

## Input schema
```json
{
  "tasks": [{ "id": "t1", "delta": 2.0, "files": ["src/a.ts"] }, { "id": "t2", "delta": 1.0, "files": ["src/b.ts"] }],
  "domains": { "t1": "frontend" },
  "coupling": [{ "a": "t1", "b": "t2", "sharedSymbols": 2, "evidence": ["a.ts:10"] }],
  "edges": [{ "from": "t2", "to": "t1", "reason": "P3: t1 imports from t2", "evidence": "src/a.ts:3" }]
}
```
- `tasks[].delta` from delta-weight table; `tasks[].files` required for file-overlap check
- `domains` optional — map task IDs to domain labels
- `coupling[]` feeds aggregate C(T) score; each pair MUST have non-empty `evidence[]`
- `edges[]` feeds schedule (level sets); each edge MUST have a non-empty `evidence` string. Edges encode P1-P4/P6. P5 pairs produce NO edge (they fall to same level by default, subject to file-overlap check).
- Script throws if: coupling evidence is empty, edge evidence is empty, same-level tasks share files, or cycle detected.

## Delta-weight table
| Change type | Delta |
|-------------|-------|
| new file > 50w | 3.0 |
| new file <= 50w | 2.0 |
| edit > 50w | 2.0 |
| edit <= 50w | 1.0 |
| rename/typo | 0.5 |

## Script output (reference — do NOT compute)
| Field | Meaning | Range |
|-------|---------|-------|
| H_norm | Normalized Shannon entropy of delta distribution | [0,1] |
| D_JS | Jensen-Shannon divergence between domain weights | [0,1] |
| I_norm_coupling_proxy | Evidence-gated coupling pressure | [0,1] |
| C_T | Composite = (H_norm + D_JS + I_norm) / k, k=active components (1-3) | [0,1] |
| routing | `{ fastLane, splitByFileCluster, splitByDomain, sequentialRequired, parallelSafe }` — **informational only**; levels drives scheduling | |
| levels | Level sets from Kahn's algorithm: `[[t1,t2],[t3]]` = parallel t1/t2 then sequential t3 | string[][] |

# Fast Lane
tau=0.25. `routing.fastLane === true` when C_T < 0.25 AND |task_set| = 1. `!quick` → C_T = 0 force fast-lane. Skip Step 2.5 only when fast lane or single file.

# Decomposition (C_T >= 0.25)
Schedule is driven by `levels` (not routing flags — those are informational). `levels` is computed by Kahn's algorithm from the `edges[]` array. Tasks with indegree 0 form level[0]; a task advances to the next level once all incoming edges are resolved.

n_max = ceil(2^H_norm) + 1 files per task. Split by file cluster if H_norm > 0.70; split by domain if D_JS > 0.15.

# Edge Classification — Evidence-Cited Only
Every P1-P4/P6 edge MUST reference a discovery citation (file:line). No citation = no assignment. Every classified edge (P1-P4 directional, P6 same-file) MUST be compiled into the `edges[]` array passed to complexity-score.mjs — this is what turns classification into an actual schedule. P5 pairs produce NO edge (they place both tasks in the same level by default, subject to the script's file-overlap check).

| Priority | Condition | Direction |
|----------|-----------|-----------|
| P1 | Both touch shared type file, one exports type other imports — **cited** | exporter → importer |
| P2 | Both touch same Layer — **cited** | smaller → larger |
| P3 | A imports from B — **cited** | B → A |
| P4 | A consumes B's export type — **cited** | B → A |
| P5 | Different domains, no imports — **discovery positively confirmed absence** | Parallel-safe |
| P6 | Same file, disjoint ranges | Sequential |

**Ambiguous**: no evidence of coupling AND no evidence ruling it out → default SEQUENTIAL (not P5). Discovery must positively confirm absence for P5.

## Plan Validation Before Execution

Before spawning level-0 implementers, validate the plan:

1. **Structural validation**: Run `tsc --noEmit` on any interfaces, types, or shared declarations the architect produced (or equivalent for non-TS domains). If structural validation fails, re-spawn architect — do not proceed with an invalid plan.
2. **Dependency completeness**: Verify every task's declared `edges[]` has a matching downstream task. No orphan edges.
3. **File disjointness**: Verify no two tasks in the same level declare overlapping file sets. (Already enforced by the script — re-verify after any edge changes.)

Rationale: A.DOT planner research (IBM, arXiv 2603.14229) shows 14.8% correctness improvement from dual validation before execution. Catches the most expensive class of error (wrong plan) before any code is written.

## Per-Level Combined GATE

After all implementers in a level return:

1. Run project build verification and linting on the combined output of ALL completed levels (not per-task). The specific tools (e.g., tsc+eslint for TypeScript, cargo check+clippy for Rust) are determined by the project's tech stack, detected via the spawn prompt's SKILLS list and project files.
2. If any type error crosses level boundaries (e.g., level 0 changes a type, level 1 uses it wrong), the combined GATE catches it.
3. If combined GATE fails, do NOT spawn the next level. Spawn fixer for affected files (max 3-4 attempts with diversity), then re-run combined GATE.
4. Only proceed to the next level when combined GATE passes on all completed output.

This prevents cross-level contract breakage — the most common multi-level failure pattern (see SKILL.md Failure #1).

# Concurrent-Writer Safety
implementer/fixer NEVER parallel-same-worktree. If splitByDomain requires parallel domain writes, each parallel implementer MUST run in separate git worktree; merge sequentially after per-worktree verification.

# False-Independence Anti-Patterns
Shared types, DB migrations, shared module/layer boundaries, cross-domain type drift, same-file parallel edits → all sequential.

## Tech Stack Detection

The MAS agents determine the project's tech stack from:
1. The SKILLS list in the spawn prompt (domain-specific tooling knowledge)
2. Project files (package.json, Cargo.toml, pyproject.toml, etc.)
3. The agent's knowledge of common verification tooling per stack

Common stacks:
| Stack | Build verification | Linting | Test |
|-------|-------------------|---------|------|
| TypeScript/JS | tsc --noEmit | eslint | jest/vitest |
| Rust | cargo check | clippy | cargo test |
| Python | mypy/pyright | ruff/flake8 | pytest |
| Go | go build | go vet | go test |
| Java | javac/mvn compile | checkstyle | mvn test |

The orchestrator does NOT hardcode any specific tool. Each spawned agent uses its SKILLS list and project context to select the appropriate verification tools.
