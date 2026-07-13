# MAS Spawn Manifest — Field Guide for AI Agents

> **Purpose**: This is the single AI-readable reference for generating valid `spawn_manifest.json`.
> Read THIS instead of `spawn-manifest.schema.json` (the raw JSON Schema is for machine validation only).
> For complete copy-adapt templates, see `manifest-examples.json` in this directory.

---

## 1. Manifest Skeleton (Annotated)

```
{
  "manifest_version": "1.0.0",          // REQUIRED. Must be exactly "1.0.0"
  "workflow_id": "wf-<date>-<slug>",     // REQUIRED. Unique ID, 1-128 chars
  "source": {                            // REQUIRED. Provenance metadata
    "decomposer": "task-decomposer",
    "decomposer_model": "<model-id>",
    "user_message": "<raw user request>",
    "domain_set": ["effect-ts"],         // REQUIRED. >=1 domain
    "created_at": "2025-01-15T10:30:00.000Z"  // ISO-8601
  },
  "routing_decision": "fast_lane",       // REQUIRED. "fast_lane" | "full_dag"
  "complexity": {                        // OPTIONAL but recommended
    "score": 0.15,                       // REQUIRED if complexity present. [0, 1]
    "h_norm": 0.0,                       // OPTIONAL. [0, 1]
    "d_js": 0.0,                         // OPTIONAL. Only when >=2 domains
    "i_norm": 0.0,                       // OPTIONAL. Only when >1 task
    "user_intent_signal": false          // OPTIONAL. true if !quick prefix
  },
  "requirements": [                      // REQUIRED. >=1 item
    {
      "id": "R1",                        // REQUIRED. Pattern: ^R\d+$
      "statement": "<human-readable>",
      "acceptance_files": ["path/to/file.ts"],  // REQUIRED. >=1, unique
      "acceptance_symbols": ["SomeSymbol"]      // OPTIONAL. unique
    }
  ],
  "nodes": [                             // REQUIRED. >=1 item
    {
      "id": "N1",                        // REQUIRED. Pattern: ^N\d+$
      "node_type": "task",               // REQUIRED. "task" | "pre_node"
      "satisfies": ["R1"],               // REQUIRED. R-IDs. Empty for pre_node
      "domain": "effect-ts",             // REQUIRED. See enum table
      "concern": null,                   // OPTIONAL. See enum table
      "target_files": ["path/to/file.ts"], // REQUIRED. >=1, unique
      "scope_lines": [                   // OPTIONAL. Per-file line constraints
        { "file": "path/to/file.ts", "start": 1, "end": 50 }
      ],
      "language": "typescript",          // REQUIRED. See enum table
      "mutation": "<single instruction>", // REQUIRED. >=1 char
      "output_files": ["path/to/file.ts"], // OPTIONAL. unique
      "imports_delta": {                 // OPTIONAL
        "added": ["import-a"],           // REQUIRED. unique strings
        "removed": []                    // REQUIRED. unique strings
      },
      "exports_delta": {                 // OPTIONAL. Same shape as imports_delta
        "added": [],
        "removed": []
      },
      "touches_symbols": ["SymbolA"],    // OPTIONAL. unique
      "phase_chain": [                   // REQUIRED. >=1 phase. See Phase Templates
        {
          "phase": "implement",          // REQUIRED. See enum table
          "type": "llm",                 // REQUIRED. "llm" | "mechanical"
          "agent": "implementer",        // REQUIRED when type=llm. See enum table
          "skills": ["effect-ts-code-conventions"], // REQUIRED when type=llm. See Valid Skills
          "context_tier": 3,             // REQUIRED when type=llm. 1 | 2 | 3 | "diff"
          "conditional": "always",       // OPTIONAL. "always" | "on_verify_fail". Default: "always"
          "max_steps": 10,              // OPTIONAL. 1-50
          "gate": "edge-judge"           // REQUIRED when phase=gate. Only "edge-judge"
        }
      ],
      "retry_budget": {                  // REQUIRED
        "max_respins": 0                 // 0 for fast_lane, 2 for full_dag. Range 0-2
      },
      "context_budget": {                // REQUIRED
        "max_tokens": 4000              // Range 256-32000. Default 4000
      }
    }
  ],
  "edges": [                             // REQUIRED. Can be empty []
    {
      "from": "N1",                      // REQUIRED. Must exist in nodes[].id
      "to": "N2",                        // REQUIRED. Must exist in nodes[].id
      "reason": "import_dependency"      // REQUIRED. See enum table
    }
  ],
  "levels": [                            // REQUIRED. >=1 level. Topological sort
    ["N1"],                              // Level 0: nodes with no incoming edges
    ["N2"]                               // Level 1: nodes whose edges satisfied by level 0
  ],
  "gates": {                             // REQUIRED
    "per_level": {
      "ast_aggregator": true             // REQUIRED. boolean
    },
    "terminal": {
      "global_judge": true               // REQUIRED. boolean
    }
  },
  "hitl": {                              // REQUIRED
    "required": true,                    // REQUIRED. boolean
    "max_feedback_loops": 3,            // REQUIRED. 0-10. Default 3
    "reentry_routing": {                // OPTIONAL. Feedback category -> re-entry point
      "implementation-redo": {
        "reenter_phase": "implement",    // See enum table
        "target_node_strategy": "affected"  // "affected" | "all" | "redecompose"
      }
    }
  },
  "metadata": {                          // REQUIRED. Must match actual counts
    "total_nodes": 1,                    // MUST equal nodes.length
    "total_edges": 0,                   // MUST equal edges.length
    "total_levels": 1,                  // MUST equal levels.length
    "max_width": 1                      // MUST equal max level size
  }
}
```

---

## 2. All Enum Values (Consolidated)

| Field | Allowed Values | Notes |
|---|---|---|
| `manifest_version` | `"1.0.0"` | Must match exactly |
| `routing_decision` | `"fast_lane"`, `"full_dag"` | fast_lane = 1 node, 0 edges, 1 level |
| `source.domain_set[]` | `"effect-ts"`, `"react-vite"`, `"shared"` | At least 1 required |
| `nodes[].domain` | `"effect-ts"`, `"react-vite"`, `"shared"` | Primary technology domain |
| `nodes[].concern` | `"error-handling"`, `"performance"`, `"concurrency"`, `"resource-lifecycle"`, `"data-validation"`, `"principle-check"`, `null` | Optional. `null` = no specific concern |
| `nodes[].node_type` | `"task"`, `"pre_node"` | pre_node must have `satisfies: []` |
| `nodes[].language` | `"typescript"`, `"javascript"`, `"rust"`, `"go"`, `"python"` | Drives edge-judge compile/lint tool |
| `nodes[].phase_chain[].phase` | `"discover"`, `"architect"`, `"implement"`, `"verify"`, `"fix"`, `"gate"` | gate = mechanical only |
| `nodes[].phase_chain[].type` | `"llm"`, `"mechanical"` | llm = spawn agent; mechanical = run TS gate |
| `nodes[].phase_chain[].agent` | `"discovery"`, `"architect"`, `"implementer"`, `"verifier"`, `"fixer"` | Required when type=llm |
| `nodes[].phase_chain[].gate` | `"edge-judge"` | Required when phase=gate. Only this value |
| `nodes[].phase_chain[].context_tier` | `1`, `2`, `3`, `"diff"` | 1=sigs only, 2=+types, 3=full, diff=unified diff |
| `nodes[].phase_chain[].conditional` | `"always"`, `"on_verify_fail"` | Default: always |
| `edges[].reason` | `"shared_type_file"`, `"shared_db_migration"`, `"same_effect_layer"`, `"import_dependency"`, `"type_contract_dependency"`, `"same_file_conservative"` | See mas-routing for classification rules |
| `hitl.reentry_routing.*.reenter_phase` | `"discover"`, `"architect"`, `"implement"`, `"verify"`, `"fix"`, `"gate"` | Where to re-enter |
| `hitl.reentry_routing.*.target_node_strategy` | `"affected"`, `"all"`, `"redecompose"` | Which nodes to re-run |

---

## 3. Valid Injectable Skills

These are the ONLY skill names valid for `phase_chain[].skills[]`.
Each must have a `skills/<name>/SKILL.md` file (C6 constraint).

### Effect-TS Domain (8 skills)

| Skill | Use For |
|---|---|
| `effect-ts-code-conventions` | Base skill for all effect-ts phases. Naming, formatting, Effect.gen style |
| `effect-ts-anti-patterns` | Verifier phases. Detect Promise-first, hidden deps, module singletons |
| `effect-ts-error-handling` | Concern: error-handling. Typed domain errors, boundary mapping, recovery |
| `effect-ts-concurrency` | Concern: concurrency. Fiber management, interruption, bounded parallelism |
| `effect-ts-resource-layer` | Concern: resource-lifecycle. Layer construction, acquisition/release |
| `effect-ts-schema` | Concern: data-validation. Schema-first design, @effect/schema contracts |
| `effect-ts-principle-thinking` | Architect phases. Core mental models — Programs as Values, Edge of World |
| `effect-ts-design-patterns` | Architect phases. Repository, UseCase/Service, CQRS-lite, DDD layering |

### React-Vite Domain (4 skills)

| Skill | Use For |
|---|---|
| `react-vite-conventions` | Base skill for all react-vite phases. Naming, file structure, consistency |
| `react-vite-anti-patterns` | Verifier phases. Detect legacy React, stale Vite configs, boundary violations |
| `react-vite-error-handling` | Concern: error-handling. Error boundaries, typed error strategies |
| `react-vite-performance` | Concern: performance. Render perf, bundle optimization, Rolldown config |

### Cross-Domain (1 skill)

| Skill | Use For |
|---|---|
| `fullstack-boundary` | Cross-domain tasks. API contracts, error propagation, Server Action wiring |

### MAS Operational Skills (DO NOT inject into phase_chain)

These are loaded by the task-decomposer and ship-mas mode via the `skill` tool, NOT injected via `phase_chain[].skills[]`:

`mas-architecture`, `mas-routing`, `mas-workflow`, `mas-complexity-scoring`, `mas-fast-path`, `mas-integrity`, `mas-aggregation`, `mas-decision`, `mas-feedback`, `mas-interrupts`, `mas-session-state`

---

## 4. Phase Chain Templates

### Fast-Lane Node (2-phase, implement + gate)

```json
[
  { "phase": "implement", "type": "llm", "agent": "implementer", "skills": ["effect-ts-code-conventions"], "context_tier": 3, "conditional": "always" },
  { "phase": "gate", "type": "mechanical", "gate": "edge-judge", "conditional": "always" }
]
```

### Full DAG Task Node (6-phase: discover → architect → implement → verify → fix → gate)

```json
[
  { "phase": "discover", "type": "llm", "agent": "discovery", "skills": ["effect-ts-code-conventions"], "context_tier": 2, "conditional": "always" },
  { "phase": "architect", "type": "llm", "agent": "architect", "skills": ["effect-ts-code-conventions", "effect-ts-design-patterns", "effect-ts-principle-thinking"], "context_tier": 2, "conditional": "always" },
  { "phase": "implement", "type": "llm", "agent": "implementer", "skills": ["effect-ts-code-conventions", "effect-ts-design-patterns"], "context_tier": 3, "conditional": "always" },
  { "phase": "verify", "type": "llm", "agent": "verifier", "skills": ["effect-ts-code-conventions", "effect-ts-anti-patterns"], "context_tier": "diff", "conditional": "always" },
  { "phase": "fix", "type": "llm", "agent": "fixer", "skills": ["effect-ts-code-conventions"], "context_tier": "diff", "conditional": "on_verify_fail" },
  { "phase": "gate", "type": "mechanical", "gate": "edge-judge", "conditional": "always" }
]
```

### Pre-Node (DB migration, 2-phase same as fast-lane)

```json
[
  { "phase": "implement", "type": "llm", "agent": "implementer", "skills": ["effect-ts-code-conventions"], "context_tier": 3, "conditional": "always" },
  { "phase": "gate", "type": "mechanical", "gate": "edge-judge", "conditional": "always" }
]
```

### React-Vite Task Node (6-phase, react skills)

```json
[
  { "phase": "discover", "type": "llm", "agent": "discovery", "skills": ["react-vite-conventions"], "context_tier": 2, "conditional": "always" },
  { "phase": "architect", "type": "llm", "agent": "architect", "skills": ["react-vite-conventions", "react-vite-performance"], "context_tier": 2, "conditional": "always" },
  { "phase": "implement", "type": "llm", "agent": "implementer", "skills": ["react-vite-conventions"], "context_tier": 3, "conditional": "always" },
  { "phase": "verify", "type": "llm", "agent": "verifier", "skills": ["react-vite-conventions", "react-vite-anti-patterns"], "context_tier": "diff", "conditional": "always" },
  { "phase": "fix", "type": "llm", "agent": "fixer", "skills": ["react-vite-conventions"], "context_tier": "diff", "conditional": "on_verify_fail" },
  { "phase": "gate", "type": "mechanical", "gate": "edge-judge", "conditional": "always" }
]
```

### Concern-Based Skill Additions

Add these to the base domain skills in `architect`, `implement`, and `fix` phases:

| Concern | Add Skill |
|---|---|
| error-handling | `effect-ts-error-handling` or `react-vite-error-handling` |
| performance | `react-vite-performance` |
| concurrency | `effect-ts-concurrency` |
| resource-lifecycle | `effect-ts-resource-layer` |
| data-validation | `effect-ts-schema` |
| principle-check | `effect-ts-principle-thinking` |
| Architecture / DDD | `effect-ts-design-patterns` + `effect-ts-principle-thinking` |

---

## 5. Cross-Document Constraints (Plain Language)

The JSON Schema validates field types and enums. These 8 constraints validate **referential integrity** between fields. The engine checks ALL of these after AJV validation. Any failure → manifest rejected.

| ID | Name | Rule | Example Violation |
|---|---|---|---|
| C1 | R-ID integrity | Every value in `nodes[].satisfies[]` must exist in `requirements[].id` | Node N1 has `satisfies: ["R3"]` but no requirement with id "R3" exists |
| C2 | N-ID integrity | Every `edges[].from` and `edges[].to` must exist in `nodes[].id`. No self-loops. | Edge N1→N3 but node N3 doesn't exist |
| C3 | Levels coverage | Every node ID appears exactly once across all `levels[]`. No missing, no duplicates. | Node N2 not in any level, or N1 in two levels |
| C4 | Topological validity | `levels[]` must be a valid topological sort of `edges[]`. No edge goes backward. | Edge N1→N2 but N2 is in level 0 and N1 is in level 1 |
| C5 | Metadata consistency | `metadata.total_nodes` = `nodes.length`, `total_edges` = `edges.length`, `total_levels` = `levels.length`, `max_width` = max level size | `total_nodes: 3` but only 2 nodes in array |
| C6 | Skill existence | Every skill name in `phase_chain[].skills[]` must have a `skills/<name>/SKILL.md` file | Skill "effect-ts-foo" referenced but no such directory |
| C7 | Fast-lane constraint | If `routing_decision` = "fast_lane": exactly 1 node, 0 edges, 1 level | `routing_decision: "fast_lane"` but 2 nodes in manifest |
| C8 | Coverage completeness | Every `requirements[].id` must be referenced by at least one task node's `satisfies[]` | Requirement R2 exists but no node has R2 in satisfies |

---

## 6. Conditional Logic (if/then rules in the schema)

These are enforced by the schema's `allOf`/`if-then` blocks:

| Condition | Consequence |
|---|---|
| `phase.type = "llm"` | `agent`, `skills`, `context_tier` become REQUIRED |
| `phase.phase = "gate"` | `type` MUST be `"mechanical"`, `gate` becomes REQUIRED |
| `node.node_type = "pre_node"` | `satisfies` MUST be empty array `[]` |

---

## 7. Common Mistakes (What the Engine Rejects)

| Mistake | Constraint | Fix |
|---|---|---|
| Forgetting `metadata` counts | C5 | Count arrays manually before writing |
| `fast_lane` with multiple nodes | C7 | fast_lane = exactly 1 node |
| Edge from N2→N1 but N1 is in level 1, N2 in level 0 | C4 | Reorder levels so source comes before target |
| Node satisfies R1 but no R1 in requirements | C1 | Add the requirement or remove from satisfies |
| Requirement R1 with no node satisfying it | C8 | Add a task node with `satisfies: ["R1"]` |
| Skill name typo like `effect-ts-convention` (missing s) | C6 | Use exact names from Valid Skills table |
| `pre_node` with `satisfies: ["R1"]` | Schema if-then | pre_nodes must have `satisfies: []` |
| `gate` phase with `type: "llm"` | Schema if-then | gate phases must have `type: "mechanical"` |
| Missing `skills` array on an llm phase | Schema if-then | Every llm phase needs `skills`, `agent`, `context_tier` |
| `workflow_id` with spaces | Schema | Use hyphens: `wf-2025-01-15-add-logging` |
| `created_at` not ISO-8601 | Schema format | Use `2025-01-15T10:30:00.000Z` format |

---

## 8. How the Engine Uses Each Field

Understanding this helps you generate manifests the engine can execute correctly.

| Manifest Field | What the Engine Does With It |
|---|---|
| `routing_decision` | Selects execution mode. fast_lane = single node, no parallelism. full_dag = multi-level Promise.all() |
| `nodes[].target_files` | Edge-judge checks SCOPE_ESCAPE: diffs touching files NOT in this list → REJECTED |
| `nodes[].scope_lines` | Edge-judge checks line ranges: diff lines outside declared ranges → REJECTED |
| `nodes[].phase_chain` | Engine executes phases verbatim in array order. No skipping (unless conditional=on_verify_fail and verify passed) |
| `nodes[].phase_chain[].skills` | Engine reads each `skills/<name>/SKILL.md` and injects full content into agent's context payload |
| `nodes[].phase_chain[].context_tier` | Engine dehydrates target_files to this tier: 1=sigs(≤1K tok), 2=+types(≤2K), 3=full(≤4K), diff=unified diff |
| `nodes[].context_budget.max_tokens` | Engine truncates dehydrated context if it exceeds this limit |
| `nodes[].retry_budget.max_respins` | On edge-judge REJECTED, engine re-runs fix→gate up to this many times. 0 = no retry |
| `nodes[].imports_delta` / `exports_delta` | AST-aggregator detects IMPORT_CONFLICT and SIGNATURE_DIVERGENCE between nodes using these |
| `nodes[].touches_symbols` | Global-judge scans for REGRESSION_VECTOR: untouched files referencing these symbols |
| `requirements[].acceptance_files` | Global-judge coverage: a requirement is COVERED only if an APPROVED node touches these files |
| `levels[]` | Engine dispatches all nodes in one level via Promise.all(), then proceeds to next level |
| `gates.per_level.ast_aggregator` | If true, engine runs diff merge + collision detection after each level completes |
| `gates.terminal.global_judge` | If true, engine runs requirements coverage map after all levels complete |
| `hitl.required` | If false and no blocking issues, engine auto-applies without user confirmation |
| `hitl.reentry_routing` | Maps feedback categories to re-entry phases for HITL re-execution |

---

## 9. Fast-Lane vs Full-DAG Decision

### Fast-Lane (ALL three must hold)

1. Complexity score C(T) < 0.25
2. Exactly 1 task
3. That task targets ≤ 2 files

**OR**: user message starts with `!quick` (overrides all, sets C(T) = 0)

### Fast-Lane Manifest Shape

| Field | Value |
|---|---|
| `routing_decision` | `"fast_lane"` |
| `nodes` | Exactly 1 node |
| `edges` | `[]` (empty) |
| `levels` | `[["N1"]]` (single level) |
| `phase_chain` | 2 phases: implement + gate |
| `retry_budget.max_respins` | `0` |

### Full-DAG Manifest Shape

| Field | Value |
|---|---|
| `routing_decision` | `"full_dag"` |
| `nodes` | 1+ task nodes (and optional pre_nodes) |
| `edges` | Dependency edges with classified reasons |
| `levels` | Topological sort of nodes |
| `phase_chain` | 6 phases per task node: discover → architect → implement → verify → fix → gate |
| `retry_budget.max_respins` | `2` |

---

## 10. Edge Classification Quick Reference

Apply in priority order (highest first). See `mas-routing` skill for full rules.

| Priority | Condition | Edge Reason | Direction |
|---|---|---|---|
| P1 | Both touch shared type file (`**/types.ts`, `**/schemas/*.ts`) | `shared_type_file` | exporter → importer |
| P2 | Both create DB migrations | `shared_db_migration` | Create pre_node → both |
| P3 | Both touch same Effect Layer | `same_effect_layer` | smaller scope → larger scope |
| P4 | A imports from B's output files | `import_dependency` | B → A |
| P5 | A consumes B's export type | `type_contract_dependency` | B → A |
| P6 | Different domains, no imports between them | (no edge) | Parallel-safe |
| P7 | Same file, disjoint line ranges | `same_file_conservative` | Sequential (conservative) |
