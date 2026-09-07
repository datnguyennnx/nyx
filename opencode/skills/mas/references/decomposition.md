# Topology

Orchestrator: classify, decompose, spawn, verify, ship/no-ship. Staged subagents (discoverer, planner, implementer, tester, diagnostician, researcher) via subagent tool, fresh context.

# Atomic Split

One task = one file cluster, one scope, zero overlap with parallel tasks. Coupled changes → interface first, then producer → consumer.

# Kahn Levels — proven

Topological sort via Kahn's algorithm: O(V+E), indegree-0 → level 0; advance when all incoming edges resolve; leftover indegree>0 = cycle → error, serialize.
https://en.wikipedia.org/wiki/Topological_sorting

```json
{"tasks":[{"id":"t1","files":["src/a.ts"]}],"edges":[{"from":"t2","to":"t1","reason":"P-BLOCKING: imports","evidence":"src/a.ts:3"}]}
```

`tasks[].files` required. Each edge MUST carry `evidence` file:line. Reject: no evidence, same-level overlap, cycles.

# CPM — proven

Critical Path Method: EF=ES+duration; TotalFloat=LS-ES (or LF-EF); zero-float path = critical, drives level order.
https://metricgate.com/docs/critical-path-method/

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

See `references/verification.md` Gate.

# Safety

Same file never parallel in one worktree; parallel writers → separate worktrees, merge sequentially. Shared types/migrations/module boundaries → sequential.

# Applicability Matrix (canonical)

| Kind | Pipeline |
|---|---|
| QUESTION | answer-only |
| DOCS | skip tester-build, keep envelope-lint |
| TRIVIAL | single implementer |
| CODE | full |
| unknown | full pipeline fallback |

Consumers: point here; do not duplicate this table.

# Grounding Rule (canonical)

Premise-check entities vs repo before plan; false premise trimmed+declared; retrieved facts > priors; ≤3 questions.

# Breadth Rule (canonical)

Angles tier-scaled SIMPLE 2 / COMPLEX 4+; saturation stop on 2 consecutive no-new; corroboration ≥2 on contested; contradiction flag; PARTIAL on overflow; never unbounded.

Consumers: point here; do not duplicate this rule.

# Prompt Template

```
CONTEXT: <1-2 sentences>
TASK: <ONE outcome>
TARGET_FILES: <paths>
REQUIREMENTS: <testable, binary PASS/FAIL>
OUTPUT_CONTRACT: <exact format>
SKILLS: <domain skills>
TOKEN_CAP: <max tokens>
KAHN_LEVEL: <level> / EDGE_ID: <edge id>
EVIDENCE_ATTACHMENT: <file:line citations>
```

Drop priority when over TOKEN_CAP: keep OUTPUT_CONTRACT+TARGET_FILES first, truncate EVIDENCE_ATTACHMENT oldest-first + note, split TARGET_FILES when still over cap. Overflow semantics: see `references/verification.md` Overflow (canonical).
