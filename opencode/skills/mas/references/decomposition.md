# Topology

The orchestrator delegates only. It reads no files and runs no scripts.

Scripts load global-first and run by absolute path under the config root, never repo-relative. Step 0 is Ground+Classify from the request, with an optional discoverer/explore scan and up to 3 `question` calls.

The orchestrator spawns fresh-context staged subagents through the subagent tool. It uses them to classify, decompose, spawn, verify, and ship/no-ship. The roles are discoverer, planner, implementer, tester, diagnostician, and researcher. Subagents never spawn subagents.

Gate rules, operator role, blocking commands, and the re-spawn budget live in `~/.config/opencode/skills/mas/references/verification.md`.

# Atomic split

One task covers one file cluster and one scope, with zero overlap against parallel tasks. A lane's diff budget is about 400 changed lines; exceeding it requires a stated justification in the handoff, and the scope contract is in `~/.config/opencode/skills/mas/references/antislop.md`. For coupled changes, change the interface first, then producer → consumer. Build a conflict graph from each lane's write-set: nodes are lanes, and an edge joins two lanes that share a write or where one lane's write is another lane's read. Compute the connected components of that graph; lanes in different components may run in parallel, and lanes in the same connected component must serialize.

# Kahn levels

Sort topologically with Kahn's algorithm: O(V+E). indegree-0 → level 0. Advance a level when all incoming edges resolve. A leftover indegree>0 = cycle → error, serialize.

```json
{"tasks":[{"id":"t1","files":["src/a.ts"]}],"edges":[{"from":"t2","to":"t1","reason":"P-BLOCKING: imports","evidence":"src/a.ts:3"}]}
```

`tasks[].files` is required. Each edge MUST carry `evidence` file:line. Reject a plan with no evidence, same-level overlap, or cycles.

# Batch targets

A batch's lanes declare `TARGET_FILES` in their handoff, and that list is each lane's effect scope. Before you spawn a batch, pass the batch's targets to the checker as an argument:

`node ~/.config/opencode/scripts/check-slices.mjs '[{"id":"L1","level":0,"targets":["opencode/a.md"]}]'`

The payload is a flat JSON array of lanes, each with `id`, `level` and `targets`. Two lanes at the same level must not share a path. A path reused at a later level is a serialised dependency, and it is legal. A finding means the plan is wrong, not the checker.

# CPM

Critical Path Method (CPM) gives each slice its schedule position:
- EF=ES+duration.
- TotalFloat=LS-ES (or LF-EF).
- The zero-float path is critical and drives level order.

Tag every slice with its float. Zero-float (critical) slices run first within a level. Critical-path slices receive verifier attention first, so tester and diagnostician effort routes to float 0 before positive-float work.

Scheduling float is advisory and never a gate check. A check earns its place only if its outcome can change the action. A check that cannot change the action does not belong in the gate.

# Edge taxonomy

| Level | Condition | Scheduling |
|---|---|---|
| P-BLOCKING | Producer output feeds consumer, cited | Sequential |
| P-PARALLEL | Cited proof of no coupling | Same level |
| P-WRITE | Same file/resource, cited | Serialized |

Resolve an ambiguous edge as SEQUENTIAL.

# Validation

1. Interfaces first.
2. No orphan edges.
3. Disjoint files per level.
4. P-WRITE in `edges[]`.
5. CRITICAL before ROUTINE: zero-float slices first, per CPM above.

# Per-level gate

Gate rules, operator role and blocking checks: `~/.config/opencode/skills/mas/references/verification.md`.

# Safety

The same file never runs parallel in one worktree. Parallel writers use separate worktrees and merge sequentially. Shared types, migrations, and module boundaries run sequentially.

# Applicability matrix

Exactly `QUESTION | DOCS | TRIVIAL | CODE | unknown`; no `CONFIG-ONLY`, no `-CHANGE` suffix, no other token is legal.

| Kind | Pipeline |
|---|---|
| QUESTION | answer-only |
| DOCS | skip tester-build, keep the deliverable validator `~/.config/opencode/scripts/envelope-lint.mjs` |
| TRIVIAL | single implementer |
| CODE | full, gate runs the deliverable validators; add `~/.config/opencode/scripts/validate-mas.mjs` only when the task edits mas config: the skill, the agents, or the scripts; `--selftest` runs at authoring time, not per task |
| unknown | full pipeline fallback, same gate as CODE |

# Grounding rule

- Premise-check entities vs repo before the plan.
- Trim and declare a false premise.
- Retrieved facts > priors.
- Ask a clarifying question only when the answer would change the route or the plan.
- Otherwise proceed.
- Cap at 3.

# Breadth rule

Scale angles by effort weight: SIMPLE 2, COMPLEX 4+. Stop on saturation after 2 consecutive rounds with no new finding. Require corroboration ≥2 on contested points. Flag contradictions.

Report PARTIAL on overflow. Never run unbounded. Local coherence is not global coherence.

When a batch composes work from more than one lane, check that the parts glue. Two lanes that assert incompatible things about the same target are a ship blocker. This holds even when each part passed its own check.

# Handoff

Sent and returned messages share ONE status vocabulary and ONE envelope shape. The shape is one-line JSON, findings as `file:line` only, never pasted content. Vocabulary and dispatch live in the shared block, whose canonical home is `~/.config/opencode/skills/mas/references/shared-rules.md` (SKILL.md and ship-mas.md mirror it). The evidence rule is in `~/.config/opencode/skills/mas/references/verification.md` Evidence, untrusted by default.

Delegation MUST carry the 11 core fields:
CONTEXT, TASK, TARGET_FILES, REQUIREMENTS, ACCEPTANCE, OUTPUT_CONTRACT, EFFORT, SKILLS, TOKEN_CAP, KAHN_LEVEL/EDGE_ID, EVIDENCE_ATTACHMENT.
plus `AUTHORIZED_SCOPE` (required) and `WORKTREE` (optional).

Field to role:
- **CONTEXT**: frame (≤2 sentences).
- **TASK**: ONE outcome.
- **TARGET_FILES**: boundary (only these change).
- **REQUIREMENTS**: testable binary scope.
- **ACCEPTANCE**: machine-checkable assertion set (test ids, artifact paths, schema checks, state assertions), which the gate consumes, not a bare exit code.
- **OUTPUT_CONTRACT**: envelope format.
- **EFFORT**: effort weight, SIMPLE 1 / MEDIUM 3 / COMPLEX 5 / CROSS-CUTTING 5.
- **SKILLS**: domain tools/sources.
- **TOKEN_CAP**: budget ceiling.
- **KAHN_LEVEL/EDGE_ID**: schedule position (`Step N/7`).
- **EVIDENCE_ATTACHMENT**: `file:line` citations.
- **AUTHORIZED_SCOPE**: the files the lane may touch and what is allowed there (verbs, paths); work outside it requires ask-to-continue, never a widened boundary mid-slice.
- **WORKTREE** (optional): the worktree path plus its branch, e.g. `path=<dir> branch=<name>`. Present only when the lane writes in a dedicated worktree; omit it when the lane writes in the primary tree; the model is in `~/.config/opencode/skills/mas/references/worktrees.md`.
One lane = one worktree/branch. A lane's worktree and branch are declared once in its handoff, are not shared with another lane, and never change mid-slice.

Drop priority over TOKEN_CAP: keep ACCEPTANCE and OUTPUT_CONTRACT first, then TARGET_FILES. Truncate EVIDENCE_ATTACHMENT oldest-first and note it. Split TARGET_FILES when still over cap. Overflow: `~/.config/opencode/skills/mas/references/verification.md`.

## Lane output contract

Lane returns stay terse and machine-parseable, matching the handoff fields above: `S-N -> file:line` plus a one-line status, never pasted content and never prose. Failure tokens:

- `too-big.` the slice exceeds TARGET_FILES, so re-decompose.
- `needs-confirm.` a premise or interface is unverified against the repo.
- `ambiguous.` the handoff does not resolve to ONE outcome.
- `regressed.` the change breaks a previously passing check.

## Spawn prompt

The orchestrator composes the spawn prompt by writing each of the 11 core field names plus `AUTHORIZED_SCOPE` (and `WORKTREE` when present) followed by its value. TARGET_FILES is a hard boundary, so nothing outside it changes. ACCEPTANCE is the machine-checkable assertion set the return is judged against. Forward `file:line` references only, never file content.

# Capability contracts

Every slice names the allowed files and the allowed verbs for its writer. Writers stay single-threaded; read-only delegates carry no write verb. A writer that needs a file outside its contract MUST stop and re-decompose, never widen its own boundary mid-slice.

# Artifact handoff

Structured artifacts only, never conversational handoff. Each stage emits a NAMED artifact with `file:line` refs: evidence map (discoverer) → plan (planner) → diff (implementer) → verdict (tester). The orchestrator forwards refs, never pasted content.
