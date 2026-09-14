# Topology

Orchestrator delegate-only: reads NO files and runs NO scripts. Scripts load global-first and run by absolute path under the config root — never repo-relative. Step 0 Ground+Classify from the request (+ optional discoverer/explore scan) + ≤3 `question`. Spawns fresh-context staged subagents (discoverer, planner, implementer, tester, diagnostician, researcher) via the subagent tool to classify, decompose, spawn, verify, ship/no-ship; subagents never spawn subagents. Gate rules, operator role, blocking commands and the re-spawn budget: `~/.config/opencode/skills/mas/references/verification.md`.

# Atomic Split

One task = one file cluster, one scope, zero overlap with parallel tasks. Coupled changes → interface first, then producer → consumer.

# Kahn Levels

Topological sort via Kahn's algorithm: O(V+E), indegree-0 → level 0; advance when all incoming edges resolve; leftover indegree>0 = cycle → error, serialize.

```json
{"tasks":[{"id":"t1","files":["src/a.ts"]}],"edges":[{"from":"t2","to":"t1","reason":"P-BLOCKING: imports","evidence":"src/a.ts:3"}]}
```

`tasks[].files` required. Each edge MUST carry `evidence` file:line. Reject: no evidence, same-level overlap, cycles.

# Batch Targets

A batch's lanes already declare `TARGET_FILES` in their handoff, and that list IS each lane's effect scope. Before spawning a batch, pass the batch's targets to the checker as an argument:

`node ~/.config/opencode/scripts/check-slices.mjs '[{"id":"L1","level":0,"targets":["opencode/a.md"]}]'`

The payload is a flat JSON array of lanes, each with `id`, `level` and `targets`; two lanes at the SAME level must not share a path, and a path reused at a LATER level is a serialised dependency and is legal. A finding means the plan is wrong, not the checker.

# CPM

Critical Path Method: EF=ES+duration; TotalFloat=LS-ES (or LF-EF); zero-float path = critical, drives level order. Tag EVERY slice with its float. Zero-float (critical) slices run FIRST within a level; critical-path slices receive verifier attention FIRST — tester/diagnostician effort routes to float 0 before positive-float work. Float computed from estimated durations is advisory, never a hard gate.

# Edge Taxonomy

| Level | Condition | Scheduling |
|---|---|---|
| P-BLOCKING | Producer output feeds consumer, cited | Sequential |
| P-PARALLEL | Cited proof of no coupling | Same level |
| P-WRITE | Same file/resource, cited | Serialized |

Ambiguous → SEQUENTIAL.

# Validation

1. Interfaces first. 2. No orphan edges. 3. Disjoint files per level. 4. P-WRITE in `edges[]`. 5. CRITICAL before ROUTINE — zero-float slices first, per CPM above.

# Per-Level Gate

Gate rules, operator role and blocking checks: `~/.config/opencode/skills/mas/references/verification.md`.

# Safety

Same file never parallel in one worktree; parallel writers → separate worktrees, merge sequentially. Shared types/migrations/module boundaries → sequential.

# Applicability Matrix

Exactly `QUESTION | DOCS | TRIVIAL | CODE | unknown`; no `CONFIG-ONLY`, no `-CHANGE` suffix, no other token is legal.

| Kind | Pipeline |
|---|---|
| QUESTION | answer-only |
| DOCS | skip tester-build, keep `~/.config/opencode/scripts/envelope-lint.mjs` |
| TRIVIAL | single implementer |
| CODE | full |
| unknown | full pipeline fallback |

# Grounding Rule

Premise-check entities vs repo before plan; false premise trimmed+declared; retrieved facts > priors; ≤3 questions.

# Breadth Rule

Angles tier-scaled SIMPLE 2 / COMPLEX 4+; saturation stop on 2 consecutive no-new; corroboration ≥2 on contested; contradiction flag; PARTIAL on overflow; never unbounded.

# Handoff

Sent and returned share ONE status vocabulary and ONE envelope shape — one-line JSON, findings as `file:line` only, never pasted content. Vocabulary + dispatch: shared block in `~/.config/opencode/skills/mas/SKILL.md`. Evidence rule: `~/.config/opencode/skills/mas/references/verification.md` Auto Report.

Delegation MUST carry exactly:
CONTEXT, TASK, TARGET_FILES, REQUIREMENTS, ACCEPTANCE, OUTPUT_CONTRACT, EFFORT, SKILLS, TOKEN_CAP, KAHN_LEVEL/EDGE_ID, EVIDENCE_ATTACHMENT.

Field→role: CONTEXT frame (≤2 sentences); TASK ONE outcome; TARGET_FILES boundary (only these change); REQUIREMENTS testable binary scope; ACCEPTANCE machine-checkable assertion set (test ids, artifact paths, schema checks, state assertions) — the gate consumes these, not a bare exit code; OUTPUT_CONTRACT envelope format; EFFORT tier — SIMPLE 1 / MEDIUM 3 / COMPLEX 5 / CROSS-CUTTING 5; SKILLS domain tools/sources; TOKEN_CAP budget ceiling; KAHN_LEVEL/EDGE_ID schedule position (`Step N/7`); EVIDENCE_ATTACHMENT `file:line` citations.

Drop priority over TOKEN_CAP: keep ACCEPTANCE + OUTPUT_CONTRACT first, then TARGET_FILES; truncate EVIDENCE_ATTACHMENT oldest-first + note; split TARGET_FILES when still over cap. Overflow: `~/.config/opencode/skills/mas/references/verification.md`.

## Spawn prompt

The orchestrator composes the spawn prompt by writing each of the eleven field names followed by its value. TARGET_FILES is a hard boundary — nothing outside it changes. ACCEPTANCE is the machine-checkable assertion set the return will be judged against. Forward `file:line` references only; never paste file content.

# Capability Contracts

Every slice names the allowed files and the allowed verbs for its writer. Writers stay single-threaded; read-only delegates carry no write verb. A writer that needs a file outside its contract MUST stop and re-decompose — never widen its own boundary mid-slice.

# Artifact Handoff

Structured artifacts only — never conversational handoff. Each stage emits a NAMED artifact with `file:line` refs: evidence map (discoverer) → plan (planner) → diff (implementer) → verdict (tester). The orchestrator forwards refs, never pasted content.
