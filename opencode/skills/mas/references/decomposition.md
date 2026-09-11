# Topology

Orchestrator delegate-only: reads NO files and runs NO scripts. Step 0 Ground+Classify from the request (+ optional discoverer/explore scan) + ≤3 `question`; Step 4 GATE consumes the tester's exit-0 verdict; Step 5 Sufficiency consumes the tester's `S-N -> file:line` table. Spawns fresh-context staged subagents (discoverer, planner, implementer, tester, diagnostician, researcher) via the subagent tool to classify, decompose, spawn, verify, ship/no-ship; subagents never spawn subagents; re-spawn budget: ~/.config/opencode/skills/mas/references/verification.md.

# Paths (canonical)

Sole canonical root: `~/.config/opencode/`. Repo `opencode/` mirrors to it. Reference scripts and skills as absolute `~/.config/opencode/{scripts,skills}/…`; scripts load global-first. Never emit repo-relative script/skill tokens.

# Atomic Split

One task = one file cluster, one scope, zero overlap with parallel tasks. Coupled changes → interface first, then producer → consumer.

# Kahn Levels — proven

Topological sort via Kahn's algorithm: O(V+E), indegree-0 → level 0; advance when all incoming edges resolve; leftover indegree>0 = cycle → error, serialize.

```json
{"tasks":[{"id":"t1","files":["src/a.ts"]}],"edges":[{"from":"t2","to":"t1","reason":"P-BLOCKING: imports","evidence":"src/a.ts:3"}]}
```

`tasks[].files` required. Each edge MUST carry `evidence` file:line. Reject: no evidence, same-level overlap, cycles.

# CPM — proven

Critical Path Method: EF=ES+duration; TotalFloat=LS-ES (or LF-EF); zero-float path = critical, drives level order.

# Edge Taxonomy

| Level | Condition | Scheduling |
|---|---|---|
| P-BLOCKING | Producer output feeds consumer, cited | Sequential |
| P-PARALLEL | Cited proof of no coupling | Same level |
| P-WRITE | Same file/resource, cited | Serialized |

Ambiguous → SEQUENTIAL.

# Validation

1. Interfaces first. 2. No orphan edges. 3. Disjoint files per level. 4. P-WRITE in `edges[]`. 5. CRITICAL before ROUTINE.

# Per-Level Gate

Both `~/.config/opencode/scripts/validate-mas.mjs` and `~/.config/opencode/scripts/envelope-lint.mjs` must exit 0. Canon: `~/.config/opencode/skills/mas/references/verification.md` Gate.

# Safety

Same file never parallel in one worktree; parallel writers → separate worktrees, merge sequentially. Shared types/migrations/module boundaries → sequential.

# Applicability Matrix (canonical)

| Kind | Pipeline |
|---|---|
| QUESTION | answer-only |
| DOCS | skip tester-build, keep `~/.config/opencode/scripts/envelope-lint.mjs` |
| TRIVIAL | single implementer |
| CODE | full |
| unknown | full pipeline fallback |

# Grounding Rule (canonical)

Premise-check entities vs repo before plan; false premise trimmed+declared; retrieved facts > priors; ≤3 questions.

# Breadth Rule (canonical)

Angles tier-scaled SIMPLE 2 / COMPLEX 4+; saturation stop on 2 consecutive no-new; corroboration ≥2 on contested; contradiction flag; PARTIAL on overflow; never unbounded.

# Handoff (canonical)

Sent and returned share ONE status vocabulary — `PASS|FAIL|PARTIAL|NO_VERIFICATION|NO_RESULTS` — one-line JSON, findings as `file:line` only, never pasted content. PASS lists `S-N -> file:line`; PARTIAL lists `remaining:N`. Evidence rule: ~/.config/opencode/skills/mas/references/verification.md Auto Report (Step 6/7) IS the canonical envelope defined once in `~/.config/opencode/skills/mas/references/verification.md`.

Delegation MUST carry exactly:
CONTEXT, TASK, TARGET_FILES, REQUIREMENTS, OUTPUT_CONTRACT, EFFORT, SKILLS, TOKEN_CAP, KAHN_LEVEL/EDGE_ID, EVIDENCE_ATTACHMENT.

Field→role: CONTEXT frame (≤2 sentences); TASK ONE outcome; TARGET_FILES boundary (only these change); REQUIREMENTS testable binary scope; OUTPUT_CONTRACT envelope format; EFFORT tier — SIMPLE 1 / MEDIUM 3 / COMPLEX 5 / CROSS-CUTTING 5; SKILLS domain tools/sources; TOKEN_CAP budget ceiling; KAHN_LEVEL/EDGE_ID schedule position (`Step N/7`); EVIDENCE_ATTACHMENT `file:line` citations.

Retry Budget: ~/.config/opencode/skills/mas/references/verification.md

Drop priority over TOKEN_CAP: keep OUTPUT_CONTRACT+TARGET_FILES first, truncate EVIDENCE_ATTACHMENT oldest-first + note, split TARGET_FILES when still over cap. Overflow: `~/.config/opencode/skills/mas/references/verification.md` Overflow (canonical).

Light refs: subagents return `file:line` refs + summaries, never long pasted content — avoids the "telephone" problem.
