---
name: mas-decomposition
description: "Reference for complexity scoring, DAG scheduling, edge taxonomy, and per-level GATE in ship-mas orchestration."
---
# Topology
L0: ship-mas = classify, decompose, spawn, verify, HITL
L1: Generic agents (discoverer, implementer, researcher) = direct tool access, domain skills via `skill` tool

# Atomic Split
Each task: one file cluster, one scope, zero overlap with parallel tasks. Coupled changes → orchestrator plans interface first, then sequential spawn.

# Complexity Scoring — Hybrid Ensemble Model
```
node ~/.config/opencode/scripts/complexity-score.mjs --input '<json>'
```
Script stdout is AUTHORITATIVE. If script throws, go back to discoverer — never estimate.

C_total = 0.44·min-cut + 0.33·(1-modularity) + 0.22·conductance
  min-cut     = coupling strength (how tightly tasks are coupled)
  modularity  = community structure (how well tasks cluster into groups)
  conductance = bottleneck density (how cleanly groups separate)

C_total < 0.25 → fast lane (skip evidence)
C_total 0.25-0.60 → normal pipeline
C_total > 0.60 → full pipeline (maximum caution)
## Input schema
```json
{
  "tasks": [{ "id": "t1", "delta": 2.0, "files": ["src/a.ts"] }, { "id": "t2", "delta": 1.0, "files": ["src/b.ts"] }],
  "domains": { "t1": "frontend" },
  "coupling": [{ "a": "t1", "b": "t2", "sharedSymbols": 2, "evidence": ["a.ts:10"] }],
  "edges": [{ "from": "t2", "to": "t1", "reason": "P-BLOCKING: t1 imports from t2", "evidence": "src/a.ts:3" }],
  "graph": {
    "adjacency": [[0, 1, 0], [1, 0, 1], [0, 1, 0]]
  }
}
```
- `tasks[].delta` from delta-weight table; `tasks[].files` required for file-overlap check
- `domains` optional — map task IDs to domain labels
- `coupling[]` feeds aggregate coupling score; each pair MUST have non-empty `evidence[]`
- `edges[]` feeds schedule (level sets); each edge MUST have a non-empty `evidence` string. Edges encode P-BLOCKING or P-WRITE. P-PARALLEL pairs produce NO edge (they fall to same level by default, subject to file-overlap check).
- `graph.adjacency` optional — N×N symmetric binary matrix (N = tasks.length). If omitted, script infers adjacency from `edges[]` and `coupling[]` (undirected union). adjacency[i][j] = 1 if task i and task j share a dependency edge or coupling pair.
- Script throws if: coupling evidence is empty, edge evidence is empty, same-level tasks share files, cycle detected, or adjacency is non-square/mismatched dimensions.

## Delta-weight table
| Change type | Delta |
|-------------|-------|
| new file > 50w | 3.0 |
| new file <= 50w | 2.0 |
| edit > 50w | 2.0 |
| edit <= 50w | 1.0 |
| rename/typo | 0.5 |

# Script Output
| Field | What it drives |
|-------|---------------|
| levels | The schedule — you MUST use this. Spawn tasks per level. |
| routing.fastLane | If true, skip evidence gathering (Step 2 of Ladder) |
| Script throws | Evidence missing, file overlap, or cycle — fix before proceeding |

# Fast Lane
tau=0.25. `routing.fastLane === true` when **C_total < 0.25** AND |task_set| = 1. Skip evidence gathering only when fastLane: true (C_total < 0.25 AND single task).

# Decomposition (C_total >= 0.25)
Schedule is driven by `levels` (not routing flags — those are informational). `levels` is computed by Kahn's algorithm from the `edges[]` array. Tasks with indegree 0 form level[0]; a task advances to the next level once all incoming edges are resolved.

n_max = ceil(2^H_norm) + 1 files per task.
H_norm = normalized task entropy from script output (range 0-1). Higher values mean tasks are more evenly distributed across clusters.
D_JS = Jensen-Shannon divergence of domain distribution from script output (range 0-1). Higher values mean tasks span more distinct domains.

Split by file cluster if H_norm > 0.70; split by domain if D_JS > 0.15.
C_total serves as the overall complexity gauge — higher C_total suggests more conservative splitting (favor smaller tasks).

# Edge Classification — 3-Level Taxonomy (replaces P1-P6)

Every P-BLOCKING / P-WRITE edge MUST reference a discoverer citation (file:line). No citation = no assignment. Every classified edge MUST be compiled into the `edges[]` array passed to complexity-score.mjs — this is what turns classification into an actual schedule. P-PARALLEL pairs produce NO edge (they place both tasks in the same level by default, subject to the script's file-overlap check).

| Level | Name | Condition | Direction | Scheduling |
|-------|------|-----------|-----------|------------|
| P-BLOCKING | Blocking | A's output is input to B; or A changes shared contract B uses (type export, API change, interface modification) — **cited** | Producer → Consumer | Sequential (wait) |
| P-PARALLEL | Parallel | No evidence of coupling; discoverer **positively confirmed absence** across all file:line pairs — no citation = not P-PARALLEL | No edge | Same level (parallel) |
| P-WRITE | Write-conflict | Both tasks modify same file/resource (even disjoint ranges) — **cited** | Smaller → Larger (or explicit order) | Same file, serialized writes within level |

**Ambiguous**: no evidence of coupling AND no evidence ruling it out → default SEQUENTIAL (not P-PARALLEL). Discoverer must positively confirm absence for P-PARALLEL.

## Delegation Gate
Before spawning any sub-agent for an edge task, apply the delegation gate:
- Is the work parallelizable across multiple files? → delegate
- Does the orchestrator lack context on the files involved? → delegate
- Is verification of the output cheaper than redoing it? → delegate
- Is the task sequential, well-understood, and self-contained? → do NOT delegate (inline)

## Plan Validation Before Execution

Before spawning level-0 implementers, validate the plan:

1. **Structural validation**: Run `tsc --noEmit` on any interfaces, types, or shared declarations the orchestrator designed. If structural validation fails, re-design before proceeding — do not proceed with an invalid plan.
2. **Dependency completeness**: Verify every task's declared `edges[]` has a matching downstream task. No orphan edges.
3. **File disjointness**: Verify no two tasks in the same level declare overlapping file sets. (Already enforced by the script — re-verify after any edge changes.)
4. **Write-conflict serialization**: For any P-WRITE pair, confirm the explicit ordering (Smaller → Larger) is reflected in `edges[]` and that the level assignment places them sequentially within the same level.
5. **Critical step identification**: Label each task as CRITICAL (~16% of steps) or ROUTINE (~84%). A step is CRITICAL if: (a) an alternate action would flip the task outcome, (b) it involves cross-crate interface design, (c) it changes a shared contract. CRITICAL steps must be validated and verified before any ROUTINE step in the same level proceeds.

Rationale: A.DOT planner research (IBM, arXiv 2603.14229) shows 14.8% correctness improvement from dual validation before execution. Catches the most expensive class of error (wrong plan) before any code is written.

## Per-Level Combined GATE

After all implementers in a level return:

1. Run project build verification and linting on the combined output of ALL completed levels (not per-task). The specific tools (e.g., tsc+eslint for TypeScript, cargo check+clippy for Rust) are determined by the project's tech stack, detected via the spawn prompt's SKILLS list and project files.
2. If any type error crosses level boundaries (e.g., level 0 changes a type, level 1 uses it wrong), the combined GATE catches it.
3. If combined GATE fails, do NOT spawn the next level. Re-spawn implementer with corrected instructions (max 3 attempts), then re-run combined GATE.
4. Only proceed to the next level when combined GATE passes on all completed output.

This prevents cross-level contract breakage — the most common multi-level failure pattern (see mas-diagnosis skill Failure #1).

# Concurrent-Writer Safety
implementer NEVER spawned parallel on same worktree. If splitByDomain requires parallel domain writes, each parallel implementer MUST run in separate git worktree; merge sequentially after per-worktree verification.

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

# Sub-Agent Context
Each sub-agent gets FRESH context — zero parent history. The task() prompt is their entire world.

## Prompt Template
```
CONTEXT: <1-2 sentence background>
TASK: <what to do>
TARGET_FILES: <paths>
REQUIREMENTS: <acceptance criteria>
OUTPUT_CONTRACT: <exact format>
SKILLS: <domain skills>
SUMMARY: ~300-500 token summary
```

## Failure Handling
| Failure | Action |
|---------|--------|
| No output/timeout | Split into smaller tasks, retry |
| Incomplete/wrong output | Re-spawn with stricter contract |
| Corrupts state | Roll back to last commit |

## Retry
1st attempt → if fail, classify (transient/scope/logic) → retry with corrected prompt
2nd attempt → if still failing, include broader context (dependencies, related files) → retry
3rd attempt → if still failing, ESCALATE to user
Max 3 attempts per sub-agent. After 3, always escalate. Never auto-retry past 3.


