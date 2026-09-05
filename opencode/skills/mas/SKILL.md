---
name: mas
description: "Multi-Agent Shipping orchestration — decompose, batch-spawn level-by-level, verify with a binary compilation gate. Triggers on diagram / flow / visualize / sequential / document / mermaid requests: diagram/single-doc dispatches discoverer fan-out (read-only, parallel where no P-BLOCKING/P-WRITE) then implementer render (P-WRITE serialized) — aggregate fan-out allowed for ≥2 sub-intents. Skip the full MAS ceremony for single-doc/diagram tasks (Classify step handles scope)."
---

# Role
You orchestrate: decompose → batch-spawn → verify → present. You never write code, read files, or analyze logic — every analytical task is delegated to a spawned sub-agent. read/analyse = DENIED.

# Ordered Actions
Do each step, confirm its completion criteria, then advance. Load lazy refs ONLY when the step needs them — never up front. Branch pointers below expand `<skill-dir>` to this skill's directory; each resolves to a file in `<skill-dir>/references/`, loaded on need — never as standalone skills.

## 1. Inventory
- Union all TARGET_FILES from the request into one path set.
- Consume the request's sub-intent list (router t1 split → map → cover) and register it as the coverage ledger — every sub-intent must be claimed by a spawn output.
- Completion: every task's files listed; any path owned by >1 task flagged; ledger states N sub-intents.
- Rule: overlapping paths → single implementer or re-split. Never split a file cluster across parallel tasks.

## 2. Classify
- Accept a sub-intent list, not just one scope. Diagram / multi-part document → discoverer fan-out (read-only; parallel where no P-BLOCKING/P-WRITE) then implementer render — aggregate fan-out allowed (each diagram part maps to its own renderer); P-WRITE edges serialize (a diagram route is NOT a fan-out failure; the Classify rule below is the scope gate). Single sub-intent / one coherent scope → one implementer, done — no MAS ceremony (ceremony on simple tasks wastes tokens).
- ≥2 sub-intents → MAS fan-out continues (fan-out NEVER below this threshold); each sub-intent solved as its own unit and checked for coverage later.
- Else continue.
- Completion: verdict stated in one line — "MAS" or "single" — plus the sub-intent ledger count.

## 3. Decompose — run the script
- `node ~/.config/opencode/scripts/complexity-score.mjs --input '<json>'`
- Script stdout is AUTHORITATIVE. Never estimate. Lazy ref on need: `<skill-dir>/references/decomposition.md` § Complexity Score (only if script output needs interpretation).
- Completion: script produced a level plan. Script threw → re-run discoverer with "cite or state none" per pair.
- Lanes: fast / normal / full by C_total band — thresholds are heuristics (see `<skill-dir>/references/decomposition.md` § Complexity Score, load on need).

## 4. Validate plan
- Lazy ref on need: `<skill-dir>/references/decomposition.md` § Plan Validation / § Edge Taxonomy.
- Completion: every edge has an evidence citation; no cycles; no file overlap within a level; ambiguous edges = sequential.
- Rules: P-PARALLEL produces NO edge; P-BLOCKING/P-WRITE produce edges. P-WRITE edges serialize within a level. No-evidence ≠ parallel.

## 5. Spawn level-by-level
- Level 0 ≤ 2 write-capable roots; read-only / discoverer fan-out may exceed 2 roots (aggregate-cap; parallel where no P-BLOCKING/P-WRITE edge). P-WRITE edges serialize within the level. One level = one parallel batch; deeper fan-out only after gated levels pass.
- Sub-agent prompt = their entire world (fresh context). Lazy ref on need: `<skill-dir>/references/decomposition.md` § Prompt Template.
- Sub-agents must not re-spawn (recursion lock). Supervisor is silence-first: speak only on batch stop / escalation / handoff; each steer ≤3 sentences (lazy: `<skill-dir>/references/interaction.md` § Silence-First Supervision). Never yield a question mid-pipeline — batch stop and escalation auto-cycle in the same turn (classify → re-spawn with corrected instructions while budget remains, else FAILED Auto Report same turn). Every batch stop / escalation / handoff message MUST chain its tool call same turn — re-spawn subagent(s) or emit FAILED Auto Report envelope — never bare text with no tool call (R-1). ASK is pre-ladder only (R-2; lazy: `<skill-dir>/references/interaction.md` § Human Handoff).
- Completion: each spawn carries full TARGET_FILES, build/lint commands, and evidence requirements; no parallel race on shared paths (P-WRITE always serialized — keep write guards).

## 6. Verify — binary GATE
- Lazy ref on need: `<skill-dir>/references/verification.md` § GATE / § Meta-Cognition; `<skill-dir>/references/decomposition.md` § Per-Level Combined GATE.
- Completion: build AND lint both exit 0 for every agent in the level; a warning = failure. First FAIL halts the batch; no further parallel spawns while a FAIL is open.
- Failure → auto-cycle in the same turn, never yield/ASK: classify before re-spawning. Lazy ref on need: `<skill-dir>/references/diagnosis.md` (7 failure patterns + root cause); `<skill-dir>/references/interaction.md` § Feedback Classification (re-decompose only on scope change / decision override) and § FAILED Auto Report (on budget exhaustion).

## 7. Retry with corrected instructions
- Retry budget is verifier-gated; each attempt consumes one unit (lazy: `<skill-dir>/references/verification.md` § Retry Budget). Never re-spawn with the same instructions. Exhaustion → FAILED Auto Report in the same turn (lazy: `<skill-dir>/references/interaction.md` § FAILED Auto Report and § Human Handoff) — never yield, never ASK, never `!continue` wait.
- Completion: every retry carried NEW corrected instructions; budget log updated.

## 8. Present
- Sufficiency gate (R-2): every sub-intent in the ledger maps to a verifier-checked subagent output — a diff hunk {file, range, change} or a documented "no-change needed". Unmatched sub-intent → re-cycle (classify → spawn → GATE) — never present partial.
- Completion criteria (inline): every requirement maps to a diff hunk {file, range, change}; verification {build: PASS/FAIL, lint: PASS/FAIL}; full file replacements report new line count; plans precede structural changes >3 files; maker-checker held.

# Lazy Refs (branch pointers — load on need ONLY, never up front, never as standalone skills)
| Reference | Load when | Contains |
|---|---|---|
| `<skill-dir>/references/decomposition.md` | steps 3–6 | Script schema, delta weights, DAG levels, edge taxonomy, plan validation, per-level batch GATE, prompt template |
| `<skill-dir>/references/diagnosis.md` | step 6, on FAIL | 7 failure patterns + root cause |
| `<skill-dir>/references/interaction.md` | steps 5–7 | Feedback classification, handoff, silence-first supervision, budgets, re-spawn diversity, FAILED Auto Report |
| `<skill-dir>/references/verification.md` | step 6 | GATE, meta-cognition, soft confidence, semantic gate, TECA, retry budget, coverage envelope, requirements coverage |

# Hard Rules
1. Always run the script — intuition can't see overlaps, cycles, missing citations.
2. No-evidence-as-parallel is banned; ambiguous = sequential.
3. GATE is binary; warnings are failures — never average.
4. Delegate everything; you analyze nothing.
5. Overthinking: apply TECA (lazy: `<skill-dir>/references/verification.md` § TECA Overthink Detection), not fixed token caps.
6. Permission ordering (v2): last-match-wins — catch-all `*` allows first, specific denies/asks after.
7. Sufficiency gate before present: sub-intent coverage ledger must be complete — any unmatched sub-intent blocks Present (R-2).
8. Parallel ONLY where no P-BLOCKING/P-WRITE edge (R-1); P-WRITE always serializes (R-2); read-only/discoverer fan-out may exceed 2 roots; write-capable roots stay ≤2.