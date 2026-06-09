---
name: mas-routing
description: DAG construction and staged parallelism scheduling rules for the Classifier agent (Tier 1). Defines edge creation decision table, false-independence anti-patterns, and spawn plan generation. Loaded by classifier and fullstack-ship.
---

## 1. DAG Construction Pseudocode

```
FUNCTION build_dag(subtask_list):
  nodes = []
  edges = []

  FOR each subtask S in subtask_list:
    node = { id: S.id, scope: S.scope, domain: S.domain, context_tier: tier_for(S) }
    nodes.push(node)

  FOR each pair (A, B) in nodes where A ≠ B:
    IF shared_type_file(A, B):
      edges.push({ from: A, to: B, reason: "shared_type_file" })
      edges.push({ from: B, to: A, reason: "shared_type_file" })
      MARK as sequential_edge — collapse into single node with 2 scopes or apply ordering

    ELSE IF shared_db_migration(A, B):
      pre = create_pre_node("migration:" + shared_migration_name)
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
      // No edge — spawn width (parallel)

  levels = toposort_and_level(nodes, edges)
  spawn_plan = build_spawn_plan(levels)

  RETURN { dag: { nodes, edges, levels }, spawn_plan }
```

## 2. Staged Parallelism Model

```
Level 0: [node_a, node_b]     ← width (parallel)
  Each node: discover → architect → implement → verify → fix → judge  ← depth (sequential)
Level 1: [node_c]             ← width (1 lane, depends on Level 0 output)
  ... depth chain ...
Level 2: [node_d, node_e]     ← width (2 lanes, both depend on Level 1)
  ... depth chains ...

After all nodes in Level L_i complete → ast-aggregator merges → advance to L_{i+1}
```

- **Width** = nodes at same topological level with zero unresolved incoming edges.
- **Depth** = per-node 6-phase execution chain, strictly sequential.
- **Merge barrier** = after each level, ast-aggregator consolidates before next level.

## 3. Spawn Decision Table

| Condition | Decision | Rationale |
|---|---|---|
| `shared_type_file(A, B)` | Sequential edge (A→B or B→A) | Both touch same shared type; race condition risk. Prefer collapse into single node if scopes are tightly coupled. |
| `shared_db_migration(A, B)` | Pre-node + 2 edges | Migration must complete before either A or B runs. Creates synthetic `migration:*` node. |
| `same_effect_layer(A, B)` | Sequential edge | Layer modification is not commutative; ordering matters. A before B or B before A based on scope order. |
| `different_domain, no_shared_contract` | No edge, spawn width | Isolated domains with independent type systems; safe to parallelize. |
| `A.imports(B.outputs)` | A depends on B | Import resolution requires B's output files exist first. |
| `A.consumes_type(B.exports)` | A depends on B | Type contract dependency requires B's types to be finalized. |
| Unrelated nodes, same domain, different files | No edge | Independent file clusters; safe to parallelize. |
| Unrelated nodes, same domain, same file but disjoint line ranges | Sequential edge (conservative) | Same-file safety; avoid merge conflicts even with disjoint ranges. |

## 4. False-Independence Anti-Patterns

These conditions LOOK independent but are NOT — they MUST be sequential:

| Anti-Pattern | Why False | Detection Rule |
|---|---|---|
| **Shared mutable type files** | Two nodes modify `types.ts` — one changes a type the other consumes. Appears independent but creates silent incompatibility. | Check if both nodes touch `**/types.ts` or `**/schemas/*.ts`. |
| **Shared DB migrations** | Two nodes each create a migration file. Both succeed individually but conflict on apply order. | Check if both nodes create files matching `**/migrations/*.sql` or `**/migrations/*.ts`. |
| **Shared Effect layers** | Two nodes modify the same `Layer` construction. Both compile but the later-applied patch overrides the earlier one's dependency. | Check if both nodes touch the same `Layer.provide(...)` or `Layer.merge(...)` call. |
| **Cross-domain type contract drift** | Backend changes a response type, frontend updates a component. If parallel, frontend may ship before backend type is finalized. | Check if a node in one domain exports a type consumed by a node in another domain. Use `fullstack-boundary` skill to detect. |
| **Same-component parallel edit** | Two nodes modify different lines of the same React component. Merge may succeed but state/hook interaction breaks at runtime. | Conservative rule: same file → sequential. Exception allowed only if architect explicitly approves disjoint scopes. |

## 5. Repo-Grounded Examples

### Example 1: Auth + API change
```
  Task: Add auth middleware to /api routes + update login form in React
  Check: Do both touch shared types?
    → auth-middleware exports `AuthUser` type
    → login-form imports `AuthUser` from shared types file
    → shared_type_file detected → NOT independent
  Decision: 2 nodes, 1 edge (login-form depends on auth-middleware)
  Levels: L0: [auth-middleware] → L1: [login-form]
```

### Example 2: Credential route + Audit log
```
  Task: Add credential rotation route + add audit logging for credential access
  Check: Does audit depend on credential?
    → audit-log imports credential route's `CredentialEvent` type
    → type_contract_dependency → NOT independent
  Decision: Sequential (credential first, audit second)
  Levels: L0: [credential-route] → L1: [audit-log]
```

### Example 3: React component + Effect-TS service
```
  Task: Add user profile React component + add user profile Effect-TS endpoint
  Check: Shared contract?
    → React component fetches from /api/user/profile (string URL, not type import)
    → Effect-TS endpoint defines response type independently
    → No shared contract file → Independent
  Decision: 2 nodes, 0 edges, 1 level
  width_lanes = [[profile-component, profile-endpoint]]
```

### Example 4: Effect layer modification in 2 services
```
  Task: Add logging to UserService + add retry to OrderService
  Check: Same Effect layer?
    → Both modify AppLayer in packages/core/src/layer.ts
    → same_effect_layer → NOT independent
  Decision: Sequential (by scope order: UserService before OrderService)
  Levels: L0: [user-logging] → L1: [order-retry]
```

## Companion Skills

- `mas-architecture` — 5-layer topology, atomic split, execution graph format
- `mas-integrity` — citation enforcement, session state, 4K sandbox
- `mas-workflow` — per-task pipeline, fan-out/fan-in, re-spin protocol
- `fullstack-boundary` — cross-domain contract verification
