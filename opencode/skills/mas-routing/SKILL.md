---
name: mas-routing
description: DAG construction rules and dependency classification for manifest generation. Conceptual definitions only — execution is handled by the TS Engine. Loaded by the task-decomposer.
---

## Edge Classification (Priority Order)

| Priority | Condition | Reason Field | Direction |
|---|---|---|---|
| P1 | Both touch shared type file (`**/types.ts`, `**/schemas/*.ts`, `**/contracts/*.ts`) AND one exports type the other imports | `shared_type_file` | exporter → importer |
| P2 | Both create DB migrations | `shared_db_migration` | Create pre-node → both |
| P3 | Both touch same Effect Layer (`Layer.provide`/`Layer.merge`) | `same_effect_layer` | smaller scope → larger |
| P4 | A imports from B's output files | `import_dependency` | B → A |
| P5 | A consumes B's export type | `type_contract_dependency` | B → A |
| P6 | Different domains, no imports between them | (no edge) | Parallel-safe |
| P7 | Same file, disjoint line ranges | `same_file_conservative` | Sequential |

## Topological Sorting

Level 0: nodes with zero incoming edges. Level N: nodes whose edges are satisfied by levels 0..N-1. Every node in exactly one level. No edges within a level. `levels[]` must be a valid topological sort — no backward edges.

## False-Independence Anti-Patterns (MUST detect)

Shared type files, shared DB migrations, shared Effect layers, cross-domain type drift, same-file parallel edit → all require sequential edges (see P1-P5, P7 above).

## Synthetic Pre-Nodes

When P2 triggers, create: `{ id: "N0", node_type: "pre_node", satisfies: [], domain: "shared", phase_chain: [implement, gate], retry_budget: { max_respins: 2 } }`. Pre-nodes participate in edges/levels identically to task nodes. See field guide Section 4 for template.
