# AGENTS.md — Nyx MAS Repository Structure

This file teaches OpenCode how to interpret and use the Nyx Multi-Agent System
architecture defined in this repository.

## Repository Layout

This repository is a **prompt-only MAS architecture** for OpenCode. It uses
three directories as instruction sources:

```
agents/          Specialized agent role prompts (Tier 1-4)
modes/           Workflow entrypoint documents (Tier 0)
skills/          Reusable domain knowledge and MAS skills
```

OpenCode does NOT auto-discover these directories. They must be loaded
explicitly by mode prompts in `opencode.json` or by agents reading them
at runtime.

## How OpenCode Uses This Repo

### 1. Mode Files (modes/*.md)
Mode files are **workflow entrypoints**. When a user activates a mode (e.g.,
`/ship-effect-ts`), OpenCode reads the corresponding `modes/*.md` file and
follows its instructions. Mode files define:
- Which orchestrator agent to delegate to first
- Workflow entry behavior (simple change, complex change, cross-domain)
- HITL loop policy and re-entry routing
- Absolute rules and tool restrictions

The mode prompt is injected via `opencode.json`:
```json
"mode": {
  "ship-effect-ts": {
    "prompt": "{file:./modes/ship-effect-ts.md}",
    ...
  }
}
```

### 2. Agent Files (agents/*.md)
Agent files are **specialized role prompts**. They are consulted or spawned
as subagents via `task`. Each agent file defines:
- Its tier responsibility (exactly one tier)
- What it does and does not do
- Which skills it must load on session start
- Forbidden actions and tool restrictions
- Input/output formats

Agents are NOT auto-registered. They exist as `.md` files in `agents/` that
are read when spawning a subagent with `task`.

**Subagent Permissions (Global Default)**: All subagents operate with full
permissions by default — every tool (read, edit, bash, glob, grep, webfetch,
question, todowrite, skill, task) is allowed. No per-agent frontmatter
permission blocks are needed. If a specific subagent requires restricted
permissions, declare an explicit `permission:` block in its frontmatter to
override the global default.

### 3. Skill Files (skills/*/SKILL.md)
Skill files are **reusable domain and MAS knowledge**. They are loaded via
the `skill` call by agents that need them. Skills define:
- Domain-specific patterns and anti-patterns
- MAS protocols (integrity, workflow, aggregation, feedback, routing)
- Reference guides and conventions

## MAS Architecture (5 Tiers)

Every active agent occupies exactly one responsibility tier:

### Tier 0 — Entry / Workflow
Files: `modes/ship-effect-ts.md`, `modes/ship-fullstack.md`, `modes/ship-react-vite.md`

Mode files are the entrypoints. They define workflow behavior, HITL policy,
and which orchestrator/agents to invoke first.

### Tier 1 — Orchestration
File: `agents/fullstack-ship.md`

Receives user tasks, decomposes into atomic subtasks, delegates scheduling
to classifier. Never performs verification or judgment itself.

For single-domain simple changes, mode files may skip Tier 1 and delegate
directly to Tier 2 or Tier 3 agents.

### Tier 2 — Scheduling and Execution Control
Files: `agents/classifier.md`, `agents/task-coordinator.md`, `agents/context-manager.md`

- **classifier**: Builds DAG from decomposition, owns dependency classification,
  outputs spawn plan. No execution.
- **task-coordinator**: Receives spawn plan, executes DAG level by level,
  retries and escalates. No decomposition, no DAG rebuilding.
- **context-manager**: Enforces context tiers, mediates what each downstream
  agent may read, logs violations to session state.

### Tier 3 — Domain Execution
Files: `agents/effect-ts-*.md`, `agents/react-vite-*.md`, `agents/verifier.md`, `agents/fixer.md`

- **effect-ts-discovery / react-vite-discovery**: Repository scanning and boundary mapping
- **effect-ts-architect / react-vite-architect**: Architecture judgment and design decisions
- **effect-ts-implementer / react-vite-implementer**: Focused code changes with minimal diffs
- **effect-ts-ship / react-vite-ship**: Domain orchestrators
- **verifier**: Single active verification agent (replaces effect-ts-review and react-vite-review)
- **fixer**: Issue resolution from verifier findings

### Tier 4 — Merge and Quality Gates
Files: `agents/ast-aggregator.md`, `agents/edge-judge.md`, `agents/global-judge.md`

- **ast-aggregator**: Merges approved patches, detects collisions
- **edge-judge**: Lint/compile gate with syntax, scope, and data-hollowing checks
- **global-judge**: Cross-references consolidated patch against requirements

## Session State

Session state is stored in the user's project directory at:

```
.opencode/session-state_<YYYY-MM-DD>_<task-slug>.json
```

The file is named with the session date and a short task slug (lowercase, hyphenated,
derived from the user request) so that each task has its own isolated state file.
No task ever overwrites another task's session state.

This file tracks:
- Current DAG and level progress
- Context tier violations
- HITL feedback log and re-entry routing
- Global judge results
- Final status

The schema is:
```json
{
  "session_id": "string",
  "created_at": "ISO-8601",
  "updated_at": "ISO-8601",
  "user_request": "string",
  "dag": null,
  "level_progress": [{"level_index": 0, "status": "pending", "completed_lanes": [], "failed_lanes": []}],
  "context_violations": [{"agent": "string", "requested_tier": 1, "served_tier": "diff", "timestamp": "ISO-8601"}],
  "hitl_feedback_log": [{"timestamp": "ISO-8601", "feedback": "string", "re_entry_point": "implementer", "loop_count": 0}],
  "global_judge_result": null,
  "final_status": null
}
```

## Key Architectural Rules

### No File-Count Thresholds
Scheduling is purely DAG-driven. The classifier agent builds a dependency
graph with explicit edge rules. File count is NEVER used as a scheduling
threshold.

### Verification is Centralized
The `verifier.md` agent is the single active verification logic. It loads
domain skills dynamically based on the `domain` field in task metadata.
`effect-ts-review.md` and `react-vite-review.md` are domain-specific verification agents
that route to verifier.

### Context Tiering is Enforced
The `context-manager.md` agent enforces context tiers centrally:
- Tier 1 (≤1K): export names + signatures only — for orchestrators
- Tier 2 (≤2K): Tier 1 + type interfaces + import graph — for architects
- Tier 3 (≤4K): full file content — for implementers and global-judge only
- Diff-only: unified diff of changed lines only — for verifier, fixer, edge-judge

Verifier and edge-judge are hard-refused Tier 3 access.

### Decomposition and Scheduling are Separate
Tier 1 (fullstack-ship) decomposes. Tier 2 (classifier) schedules. Tier 2
(task-coordinator) executes. These three concerns never mix.

## Agent Routing

| Task Domain | Verification Agent |
|---|---|
| effect-ts | `effect-ts-review` or `verifier` with domain=effect-ts |
| react-vite | `react-vite-review` or `verifier` with domain=react-vite |
| shared | `verifier` with domain=shared |

## Integration Notes

This repository does NOT use `.opencode/` for configuration. All integration
with OpenCode happens through:
1. `opencode.json` — mode definitions, permissions, MCP config
2. `AGENTS.md` (this file) — project-wide rules read by OpenCode
3. Explicit file loading via `{file:./path}` in mode prompts

OpenCode treats `agents/`, `modes/`, and `skills/` as regular directories.
They are used by agents that read and spawn from them, not by OpenCode's
native path discovery.
