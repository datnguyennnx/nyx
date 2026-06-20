---
name: mas-routing
description: DAG construction and staged parallelism scheduling. Edge creation rules,
false-independence anti-patterns, spawn plan generation. Loaded by classifier and task-decomposer.
---

## 1. DAG Construction

```
FUNCTION build_dag(subtask_list):
  nodes = [], edges = []
  FOR each subtask S:
    node = { id, scope, domain, context_tier }
    nodes.push(node)
  FOR each pair (A, B) in nodes where A ≠ B:
    IF shared_type_file(A, B):
      edges.push({ from: A, to: B, reason: "shared_type_file" })
      edges.push({ from: B, to: A, reason: "shared_type_file" })
      // collapse into single node or apply ordering
    ELSE IF shared_db_migration(A, B):
      pre = create_pre_node("migration:" + name)
      nodes.push(pre)
      edges.push({ from: pre, to: A, reason: "shared_db_migration" })
      edges.push({ from: pre, to: B, reason: "shared_db_migration" })
    ELSE IF same_effect_layer(A, B):
      edges.push({ from: A, to: B, reason: "same_effect_layer" })
    ELSE IF A.imports_from(B.outputs):
      edges.push({ from: B, to: A, reason: "import_dependency" })
    ELSE IF B.imports_from(A.outputs):
      edges.push({ from: A, to: B, reason: "import_dependency" })
    ELSE IF A.consumes_type(B.exports):
      edges.push({ from: B, to: A, reason: "type_contract_dependency" })
    ELSE IF different_domain(A, B) AND no_shared_contract(A, B):
      // no edge — parallel
  levels = toposort_and_level(nodes, edges)
  RETURN { dag: { nodes, edges, levels }, spawn_plan }
```

## 2. Staged Parallelism

```
Level 0: [node_a, node_b]     ← width (parallel)
  Each: discover → architect → implement → verify → fix → judge  ← depth
Level 1: [node_c]             ← depends on L0 output
Level 2: [node_d, node_e]     ← depends on L1
```

- **Width**: nodes at same topological level, zero unresolved incoming edges
- **Depth**: per-node 6-phase chain, strictly sequential
- **Merge barrier**: ast-aggregator consolidates after each level

## 3. Edge Decision Table

| Condition | Edge | Reason |
|---|---|---|
| `shared_type_file(A, B)` | A→B or B→A (sequential) | Both touch shared type file |
| `shared_db_migration(A, B)` | pre-node → A, pre-node → B | Migration before code |
| `same_effect_layer(A, B)` | A→B (scope order) | Layer construction non-commutative |
| `A.imports(B.outputs)` | B→A | Import dependency |
| `A.consumes_type(B.exports)` | B→A | Type contract dependency |
| `different_domain, no_shared_contract` | No edge | Isolated domains, parallel safe |
| Same domain, different files | No edge | Independent clusters |
| Same domain, same file, disjoint ranges | Sequential (conservative) | Merge safety |

## 4. False-Independence Anti-Patterns

| Pattern | Detection |
|---|---|
| Shared type files | Both touch `**/types.ts` or `**/schemas/*.ts` |
| Shared DB migrations | Both create `**/migrations/*.sql` or `**/migrations/*.ts` |
| Shared Effect layers | Both touch `Layer.provide(...)` or `Layer.merge(...)` |
| Cross-domain type drift | Node in domain A exports type consumed by node in domain B |
| Same-component parallel edit | Same file → sequential (exception: architect-approved disjoint scopes) |
