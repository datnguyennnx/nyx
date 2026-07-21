---
name: mas-decomposition
description: "Reference for complexity scoring, DAG scheduling, edge taxonomy, and per-level GATE in ship-mas orchestration."
---
# Topology
L0: ship-mas = classify, decompose, spawn, verify, HITL
L1: Generic agents (discovery, implementer, researcher) = direct tool access, domain skills via `skill` tool

# Atomic Split
Each task: one file cluster, one scope, zero overlap with parallel tasks. Coupled changes → orchestrator plans interface first, then sequential spawn.

# Complexity Scoring — Hybrid Ensemble Model
```
bash: node ~/.config/opencode/scripts/complexity-score.mjs --input '<json>'
```
Script stdout is AUTHORITATIVE. If script throws (no evidence on coupling/edge), go back to discovery — never estimate.

The composite complexity score `C_total` is a weighted ensemble of three signals:

| Component | Source | Range | Weight |
|-----------|--------|-------|--------|
| C_min_norm | Normalized Stoer-Wagner minimum cut cost of task constraint graph. Measures information bottleneck when partitioning tasks across agents. | [0,1] | α = 0.44 |
| 1 - Q | Complement of Newman-Girvan modularity score of the level partition. Higher modularity = well-separated communities = lower complexity. | [0, 1.5] → clamped to [0,1] | β = 0.33 |
| avg_conductance | Mean conductance across all task clusters (Kannan, Vempala, Vetta). Lower = better separation. | [0,1] | γ = 0.22 |

```
C_total = α · C_min_norm + β · (1 - Q) + γ · avg_conductance
```

Weights normalized from original ratios (0.4:0.3:0.2) → α=0.44, β=0.33, γ=0.22. Validated in arXiv:2507.07074 (Ebadulla et al., 2025).
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

## Script output (reference — do NOT compute)
| Field | Meaning | Range |
|-------|---------|-------|
| H_norm | Normalized Shannon entropy of delta distribution | [0,1] |
| D_JS | Jensen-Shannon divergence between domain weights | [0,1] |
| C_min_norm | Normalized minimum cut cost of task constraint graph (Stoer-Wagner) | [0,1] |
| Q | Modularity score of the level partition (from `levels` community assignment) | [-0.5, 1.0] |
| avg_conductance | Mean conductance across all level clusters | [0,1] |
| C_total | Weighted ensemble = α·C_min_norm + β·(1-Q) + γ·avg_conductance | [0,1] |
| routing | `{ fastLane, splitByFileCluster, splitByDomain, sequentialRequired, parallelSafe }` — **informational only**; levels drives scheduling | |
| levels | Level sets from Kahn's algorithm: `[[t1,t2],[t3]]` = parallel t1/t2 then sequential t3 | string[][] |

# Fast Lane
tau=0.25. `routing.fastLane === true` when **C_total < 0.25** AND |task_set| = 1. `!quick` → C_total = 0 force fast-lane. Skip Step 2.5 only when fast lane or single file.

# Decomposition (C_total >= 0.25)
Schedule is driven by `levels` (not routing flags — those are informational). `levels` is computed by Kahn's algorithm from the `edges[]` array. Tasks with indegree 0 form level[0]; a task advances to the next level once all incoming edges are resolved.

n_max = ceil(2^H_norm) + 1 files per task. Split by file cluster if H_norm > 0.70; split by domain if D_JS > 0.15. C_total serves as the overall complexity gauge — higher C_total suggests more conservative splitting (favor smaller tasks).

# Edge Classification — 3-Level Taxonomy (replaces P1-P6)

Every P-BLOCKING / P-WRITE edge MUST reference a discovery citation (file:line). No citation = no assignment. Every classified edge MUST be compiled into the `edges[]` array passed to complexity-score.mjs — this is what turns classification into an actual schedule. P-PARALLEL pairs produce NO edge (they place both tasks in the same level by default, subject to the script's file-overlap check).

| Level | Name | Condition | Direction | Scheduling |
|-------|------|-----------|-----------|------------|
| P-BLOCKING | Blocking | A's output is input to B; or A changes shared contract B uses (type export, API change, interface modification) — **cited** | Producer → Consumer | Sequential (wait) |
| P-PARALLEL | Parallel | No evidence of coupling; discovery **positively confirmed absence** across all file:line pairs — no citation = not P-PARALLEL | No edge | Same level (parallel) |
| P-WRITE | Write-conflict | Both tasks modify same file/resource (even disjoint ranges) — **cited** | Smaller → Larger (or explicit order) | Same file, serialized writes within level |

**Ambiguous**: no evidence of coupling AND no evidence ruling it out → default SEQUENTIAL (not P-PARALLEL). Discovery must positively confirm absence for P-PARALLEL.

**Mapping from P1-P6**: P1/P2/P3/P4 → P-BLOCKING; P5 → P-PARALLEL; P6 → P-WRITE. No behavioral change — just simplified categories.

## Plan Validation Before Execution

Before spawning level-0 implementers, validate the plan:

1. **Structural validation**: Run `tsc --noEmit` on any interfaces, types, or shared declarations the orchestrator designed. If structural validation fails, re-design before proceeding — do not proceed with an invalid plan.
2. **Dependency completeness**: Verify every task's declared `edges[]` has a matching downstream task. No orphan edges.
3. **File disjointness**: Verify no two tasks in the same level declare overlapping file sets. (Already enforced by the script — re-verify after any edge changes.)
4. **Write-conflict serialization**: For any P-WRITE pair, confirm the explicit ordering (Smaller → Larger) is reflected in `edges[]` and that the level assignment places them sequentially within the same level.

Rationale: A.DOT planner research (IBM, arXiv 2603.14229) shows 14.8% correctness improvement from dual validation before execution. Catches the most expensive class of error (wrong plan) before any code is written.

## Per-Level Combined GATE

After all implementers in a level return:

1. Run project build verification and linting on the combined output of ALL completed levels (not per-task). The specific tools (e.g., tsc+eslint for TypeScript, cargo check+clippy for Rust) are determined by the project's tech stack, detected via the spawn prompt's SKILLS list and project files.
2. If any type error crosses level boundaries (e.g., level 0 changes a type, level 1 uses it wrong), the combined GATE catches it.
3. If combined GATE fails, do NOT spawn the next level. Re-spawn implementer with corrected instructions (max 3 attempts), then re-run combined GATE.
4. Only proceed to the next level when combined GATE passes on all completed output.

This prevents cross-level contract breakage — the most common multi-level failure pattern (see SKILL.md Failure #1).

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

# Managing the Sub-Agent Context Window

Sub-agents spawned via `task()` get a **fresh context window** — they do NOT inherit the parent orchestrator's accumulated conversation. This is the primary defense against context bloat. Design each task() prompt accordingly.

## Context Isolation Rules

| Rule | Why |
|------|-----|
| Sub-agent starts with ZERO parent context | Prevents 100K+ token conversations from being copied to every child |
| Only pass what's in the `task()` prompt | The prompt is the sub-agent's entire world model |
| Never pass full conversation history | Defeats the purpose of context isolation |
| Include a clear output contract | The sub-agent's response is compressed to ~500 tokens when returned |

## Optimal File Sizing

| File Type | Max Size | Why |
|-----------|----------|-----|
| SKILL.md body | ≤500 lines | agentskills.io spec limit; prevents context overflow |
| Reference file | ≤200 lines | Loaded on demand; keep focused per topic |
| Agent definition | ≤100 lines | Frontmatter + brief instructions only |
| Sub-agent output summary | ~500 tokens | Parent must absorb this; keep concise |
| Tool output (untruncated) | 2000 lines / 50KB | OpenCode's built-in truncation boundary |

## Sub-Agent Prompt Structure

Every `task()` prompt should follow this optimized structure:

```
CONTEXT: <1-2 sentences of essential background only>
TASK: <single, natural-language description of what to do>
TARGET_FILES: <specific paths the agent may modify>
REQUIREMENTS: <acceptance criteria — what success looks like>
OUTPUT_CONTRACT: <exact format for the return value>
SKILLS: <domain skills to load>
SUMMARY: When finished, write a clear summary of your findings/ changes as your final response. This summary will be returned to the parent orchestrator. Be concise — aim for 300-500 tokens.
```

## Failure Handling Patterns

| Failure mode | Detection | Action |
|---|---|---|
| Sub-agent returns no output | task() returns empty or times out | Retry once with stricter scope. If still empty, split into smaller sub-tasks. |
| Sub-agent returns incomplete output | Output doesn't match OUTPUT_CONTRACT | Re-spawn with explicit template. Add "fill every field" instruction. |
| Sub-agent takes too long | No response within expected time | Set explicit step limits. Use simpler agent type. |
| Sub-agent corrupts shared state | Post-spawn build fails | Roll back to last checkpoint. Re-spawn with read-only tools first. |
| Hallucination propagation | Output cites files/lines that don't exist | Add "only cite what you actually observed" to prompt. Verify citations post-spawn. |

## Sub-Agent Bounded Retry Strategy

```
1st attempt: Standard task() with full prompt
  └─ Success → return result
  └─ Failure → classify:
       ├─ Transient (timeout, rate limit) → retry with same prompt, exponential backoff
       ├─ Scope too broad → split into 2 smaller tasks, retry each
       └─ Logic error → add explicit constraint to prompt, retry once
2nd attempt: Modified prompt based on failure classification
  └─ Success → return result
  └─ Failure → ESCALATE to user with failure summary
```

Max 2 retry attempts per sub-agent. After 2 failures, the issue is structural — do not auto-retry.

## Context Budget Allocation Per Level

| Pipeline Stage | Context budget | Notes |
|----------------|---------------|-------|
| Orchestrator (ship-mas) | Full (instructions + mode + mas skill + conversation) | Must fit within model's context window |
| Level 0 sub-agents | Task prompt only (~500-2000 tokens) | Fresh context per agent |
| Level 1 sub-agents | Task prompt + Level 0 output summaries (~1000-3000 tokens) | Include only relevant summaries |
| Level N sub-agents | Task prompt + accumulated summaries from prior levels | Each level adds ~500 tokens max |
| Re-spawn implementer | Error output + narrowed task prompt | Keep minimal — errors are already verbose |

## Reference File Loading Strategy

- **SKILL.md**: Loaded on demand via `skill()` tool. Keep < 500 lines. This is the entry point.
- **Reference files**: Also loaded on demand via `skill({name: "mas-decomposition"})`. Each reference should cover ONE topic. Keep < 200 lines.
- **Never nest references deeper than 1 level**: SKILL.md → reference/file.md [PASS]. SKILL.md → reference/subdir/file.md [FAIL]. Deep nesting causes partial reads (agent may only `head -100`).

## "Lost in the Middle" Mitigation

Long prompts cause the model to forget information in the middle. Mitigations:

1. **Front-load critical instructions**: Core rule, traps, and task definition go FIRST
2. **Back-load reference data**: Lookup tables, command references go LAST
3. **Avoid long lists in the middle**: Tables > 10 rows should be in reference files
4. **Sub-agent delegation is itself a mitigation**: Each sub-agent works in a compact context
5. **Summarize before passing**: Never pass raw output from one agent to another — summarize to ~500 tokens first
