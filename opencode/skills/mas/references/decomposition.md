# Topology
L0: ship-mas = classify, decompose, spawn, verify, ship/no-ship (FAILED envelope + auto re-spawn; no presentation yield)
L1: generic agents (discoverer, implementer, researcher) = direct tool access, domain skills via `skill` tool

# Atomic Split
One task = one file cluster, one scope, zero overlap with parallel tasks. Coupled changes → plan interface first, then sequential spawn.

# Complexity Score — Run the Script
Run the command from SKILL.md Step 3 (canonical); this section only interprets output, never runs it. Script stdout is AUTHORITATIVE. Script throws → back to discoverer. Never estimate.

C_total = 0.44·min-cut + 0.33·(1-modularity) + 0.22·conductance
- C_total < 0.25 → fast lane (skip evidence)
- C_total 0.25-0.60 → normal pipeline
- C_total > 0.60 → full pipeline

Coefficients and band thresholds are HEURISTICS tuned for ship-mas orchestration, informed by the ensemble-validation concept (Ebadulla et al. 2025, arXiv 2507.07074 — concept backing only, not a validated calibration). Never hand-compute; script stdout stays authoritative.

## Input schema
```json
{
  "tasks": [{ "id": "t1", "delta": 2.0, "files": ["src/a.ts"] }, { "id": "t2", "delta": 1.0, "files": ["src/b.ts"] }],
  "domains": { "t1": "frontend" },
  "coupling": [{ "a": "t1", "b": "t2", "sharedSymbols": 2, "evidence": ["a.ts:10"] }],
  "edges": [{ "from": "t2", "to": "t1", "reason": "P-BLOCKING: t1 imports from t2", "evidence": "src/a.ts:3" }],
  "graph": { "adjacency": [[0, 1, 0], [1, 0, 1], [0, 1, 0]] }
}
```
- `tasks[].delta` from delta-weight table; `tasks[].files` required for file-overlap check
- `coupling[]` → aggregate coupling score; each pair MUST have non-empty `evidence[]`
- `edges[]` → schedule (level sets); each edge MUST have non-empty `evidence`. P-BLOCKING / P-WRITE produce edges; P-PARALLEL produces NO edge (default same level, subject to file-overlap check)
- `graph.adjacency` optional — N×N symmetric binary matrix; if omitted, script infers from `edges[]` ∪ `coupling[]`
- Script throws on: empty coupling/edge evidence, same-level file overlap, cycle, non-square/ mismatched adjacency

## Delta-weight table
| Change type | Delta |
|-------------|-------|
| new file > 50w | 3.0 |
| new file <= 50w | 2.0 |
| edit > 50w | 2.0 |
| edit <= 50w | 1.0 |
| rename/typo | 0.5 |

# Schedule
- `levels` from Kahn's algorithm over `edges[]`: indegree-0 → level 0; a task advances once all incoming edges resolve. Info flags never override `levels`.
- Split: by file cluster when H_norm > 0.70; by domain when D_JS > 0.15 (thresholds are heuristics). Higher C_total → smaller tasks.
- fastLane: C_total in the fast-lane band (see Complexity Score) AND single task → skip evidence.

# Edge Taxonomy — 3 Levels
Every P-BLOCKING / P-WRITE edge MUST cite a discoverer file:line. No citation = no assignment.

| Level | Name | Condition | Direction | Scheduling |
|-------|------|-----------|-----------|------------|
| P-BLOCKING | Blocking | A's output or shared contract feeds B — cited | Producer → Consumer | Sequential |
| P-PARALLEL | Parallel | Positive confirmation of no coupling — cited | No edge | Same level |
| P-WRITE | Write-conflict | Both modify same file/resource — cited | Smaller → Larger | Serialized within level |

Ambiguous → SEQUENTIAL. Discoverer must positively confirm absence for P-PARALLEL.

## Delegation Gate
Delegate when: parallelizable across files, orchestrator lacks file context, or verification cheaper than redoing. Sequential + self-contained → inline. Calibration stats: interaction.md § Delegation Threshold Calibration (lazy ref — load on need).

## Plan Validation
1. Structural: `tsc --noEmit` on designed interfaces; fail → re-design first.
2. Dependency completeness: no orphan edges.
3. File disjointness: no overlapping file sets within a level (script enforces; re-verify after edge edits).
4. P-WRITE ordering reflected in `edges[]` and same-level sequence.
5. CRITICAL vs ROUTINE: CRITICAL = alternate action flips outcome, cross-crate interface, or shared-contract change. CRITICAL validates before ROUTINE in the same level. (~16/84 split = heuristic, not measured.)

# Per-Level Combined GATE (checked batch)
1. Run build + lint once per level on the combined output of ALL completed levels, not per-task.
2. Cross-level type break → caught here.
3. Fail → STOP the batch: do not spawn the next level. Auto-cycle same turn with no presentation yield: diagnostician (fresh context) → re-spawn implementer per Re-spawn Diversity Strategy (interaction.md § Re-spawn Diversity Strategy) → re-run GATE, ladder auto re-climbs. Each FAIL consumes one retry-budget unit (tiers in verification.md § Retry Budget). Exhausted → auto-escalation boundary — never weaken the GATE.
4. Next level only after combined GATE passes.

Cross-level contract break is the most common multi-level failure (diagnosis.md #1).

# Concurrent-Writer Safety
implementer NEVER spawned parallel on same worktree. Parallel domain writes → separate git worktrees; merge sequentially after per-worktree verification.

# False-Independence Anti-Patterns
Shared types, DB migrations, shared module/layer boundaries, cross-domain type drift, same-file parallel edits → all sequential.

# Tech Stack Detection
Agents pick tools from their SKILLS list + project files (tsc+eslint, cargo check+clippy, mypy/pyright+ruff, go build+vet, mvn+checkstyle). Orchestrator never hardcodes a stack.

# Pi-Fabric Batching & Lazy Loading
- **Parallel thunks**: spawn all agents of a level as one checked batch. Batch STOP = first combined-GATE FAIL (auto-cycle same turn + ladder auto re-climb; no mid-batch parallel spawns continue, no presentation yield). Levels still sequential.
- **Fan-out by access class**: read-only/discoverer roots are unrestricted — fan out beyond 2 roots in parallel ONLY when the level has no P-BLOCKING and no P-WRITE edges (no producer→consumer edges and no shared-file writers). Anything else stays sequential: P-BLOCKING → level order; P-WRITE → serialized within level (smaller→larger per taxonomy); ambiguous → SEQUENTIAL (line 57). Writers never fan out: parallel domain writes go to separate git worktrees, merged sequentially after per-worktree verification (Concurrent-Writer Safety).
- **Path dedup preflight**: before spawning, union all `TARGET_FILES`; any path owned by >1 task in a level → reject (P-WRITE serialize or re-split).
- **Lazy refs**: reference canonical sections (§) instead of repeating them (delegation, budgets, re-spawn, taxonomy). Load the referenced file only when that decision is reached.

# Sub-Agent Context
Each sub-agent gets FRESH context — zero parent history. The subagent() prompt is their entire world.

## Prompt Template
```
CONTEXT: <1-2 sentence background>
TASK: <ONE outcome — a single deliverable, never a multi-goal list>
TARGET_FILES: <paths>
REQUIREMENTS: <testable criteria — each binary PASS/FAIL against build/lint; output delivered as an envelope per verification.md § Verification Envelopes>
OUTPUT_CONTRACT: <exact format>
SKILLS: <domain skills>
SUMMARY: ~300-500 token summary
```

## Failure Handling — Auto-Cycle
Never halt mid-loop while retry budget remains; each cycle consumes one budget unit.

| Failure | Auto action (next cycle) |
|---------|--------|
| No output/timeout | Split smaller, re-spawn |
| Incomplete/wrong output | Diagnostician → re-spawn with stricter contract |
| Combined GATE fail | Diagnostician → re-spawn per diversity strategy → re-run GATE |
| Corrupts state | Roll back to last commit, re-spawn |
| Budget exhausted | Auto-escalation boundary |

Retry strategy: interaction.md § Re-spawn Diversity Strategy.