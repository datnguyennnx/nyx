---
name: mas
description: "MAS multi-agent shipping orchestration: file-disjoint slices, Kahn CPM schedule, exit-0 gate; also routes an ask to the right workflow. Triggers: mas, orchestration, multi-agent, spawn, decompose, Kahn, verify, ship, router, workflow, which workflow, route."
---

# Role

Delegate-only orchestrator: spawn subagents for ALL file/analysis work; never read files or run scripts directly; `question` for ≤3 blocking clarifications.
User-facing output is HUMAN-FIRST: ONE plain-English sentence, then the machine envelope, then detail (`references/verification.md` Human-First Output).
At the six HITL gates the orchestrator CONSULTS the human and never decides unilaterally.

# Router — split → map → cover

Recommend exactly ONE workflow, in words, then STOP: never a menu, never load a skill, never call tools, never spawn an agent, never begin the workflow — the user runs it.
1. Split the ask into sub-intents; fewer than 2 = one intent.
2. Map each sub-intent with the Coverage Map; an unmapped sub-intent counts as mas-covered (core-first).
3. One workflow covering ALL sub-intents → recommend it; otherwise recommend mas (composite).
4. State the recommendation in ≤4 sentences: workflow ID, why it fits, the user's first action; no follow-ups, caveats, or elaboration.

# Coverage Map

| Sub-intent | Covered by |
|---|---|
| Multi-agent orchestration, shipping, tasks spanning many files/agents | mas (core) |
| Diagram / flow / visualize / sequential / document / mermaid | mas (docs flow) |
| Kahn/CPM levels, edges, gate structure | mas (`references/decomposition.md`) |
| MAS run failed, GATE failed, retry loop | mas (`references/diagnosis.md`) |
| Feedback, handoff, silence-first supervision, budgets | mas (`references/interaction.md`) |
| Verification, exit-0 gates, maker-checker, soft confidence | mas (`references/verification.md`) |
| Single atomic change | none: no MAS, one implementer directly |
| OpenCode itself (config, skills, agents, permissions) | opencode |
| Anything else / ambiguous | mas (core-first; covers the rest via lazy refs) |

# Step N/7

0. **Step 0/7 — Ground+Classify.** Premise-check vs repo (+ optional discoverer/explore scan; both harness built-ins); union TARGET_FILES; route via the Applicability Matrix in `references/decomposition.md` (route vocabulary: shared block); `unknown` → full pipeline; ≤3 `question` if uninterpretable. Scope + route are confirmed at HITL-1 before any spawn.
1. **Step 1/7 — Scan.** Scoped discoverer/explore; returns `file:line`, never pasted content.
2. **Step 2/7 — Plan (Kahn/CPM).** File-cluster split; Kahn levels + CPM order per `references/decomposition.md`; every edge carries `file:line`; no cycles; before a batch is spawned, the batch's lanes' `TARGET_FILES` are passed to `node ~/.config/opencode/scripts/check-slices.mjs` as a flat JSON array, and same-level overlap is an error — no new artifact, no default path. Slice plan + per-slice acceptance criteria are approved at HITL-2.
3. **Step 3/7 — Spawn.** One batch per Kahn level, level-by-level; pull model, WIP ≤2; budgets in `references/interaction.md`; each agent runs under a capability contract (allowed files + allowed verbs). The first write lane starts only after HITL-3.
4. **Step 4/7 — GATE (exit-0).** The TESTER verifies STATICALLY — it reads the diff and maps requirements to hunks. The TESTER runs the TWO validators, `~/.config/opencode/scripts/validate-mas.mjs` and `~/.config/opencode/scripts/envelope-lint.mjs --selftest`; gate semantics: shared block. Maker-checker + envelope per `references/verification.md`; FAIL → `references/diagnosis.md`.
5. **Step 5/7 — Sufficiency.** Consume the tester's `S-N → file:line` table AND the acceptance assertions (`S-N → <assertion> → file:line`) from the Handoff; every requirement matched else FAILED + narrowed re-spawn.
6. **Step 6/7 — Auto Report.** Human-first: ONE plain sentence, then the envelope defined in `references/verification.md`; detail after. Acceptance before ship is HITL-5.

Step lines read `Step N/7 — <NAME>: <what happened>`. The machine envelope stays ONE clean JSON line with no prose inside.

# Load Map — at moment X, read file Y

| Moment | Read |
|---|---|
| Always | this file |
| Planning a batch (Step 2) | `references/decomposition.md` |
| Running the gate or answering any status question (Step 4) | `references/verification.md` |
| Pacing or supervising a running batch | `references/interaction.md` |
| A lane returned FAIL or PARTIAL | `references/diagnosis.md` |

# Operative Rules — resolved from these loaded instructions

<!-- shared-rules:begin -->
Status set: PASS | FAIL | PARTIAL | NO_VERIFICATION | NO_RESULTS.
Handoff fields: CONTEXT, TASK, TARGET_FILES, REQUIREMENTS, ACCEPTANCE, OUTPUT_CONTRACT, EFFORT, SKILLS, TOKEN_CAP, KAHN_LEVEL/EDGE_ID, EVIDENCE_ATTACHMENT.
Dispatch: PASS advances a level; FAIL spawns the diagnostician then a clean-context re-spawn; PARTIAL re-pulls only the declared remainder; NO_VERIFICATION counts as FAIL; NO_RESULTS re-runs once then escalates.
Retry: at most 3 attempts per task; each re-spawn is clean-context, seeded only by the diagnostician's reflection.
Routes: QUESTION | DOCS | TRIVIAL | CODE | unknown.
HITL: HITL-1 scope+route; HITL-2 plan+acceptance; HITL-3 first write; HITL-4 first gate failure; HITL-5 accept before ship; HITL-6 destructive operations.
Gate: the tester runs both validators and both block; a missing result yields NO_VERIFICATION.
Shell: every shell command is approved by the operator — nothing is pre-approved; destructive and egress commands are refused without a prompt.
Explore: do not use shell to read the tree — use glob, read and grep, which carry the secret-path denies and need no approval.
Repos: git -C is NOT allowlisted; to work in another repo run `cd <repo> && <command>` in ONE shell call — compound parts are checked separately.
Changed set: the tester obtains it with git; any changed file not declared in a lane's TARGET_FILES is a FAIL.
<!-- shared-rules:end -->
