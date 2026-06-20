---
name: mas-architecture
description: 5-layer MAS topology, atomic split rules, execution graph JSON schema, Dehydrate-Hydrate,
worker constraints, transaction log format. Loaded by all ship orchestrators.
---

## 5-Layer Architecture

```
L5: Codebase (filesystem)
L4: global-judge — requirements-mutation check → APPROVED/APPROVED_WITH_NOTES/NEEDS_REMEDIATION
L3: ast-aggregator — diff merge, collision detection → consolidated patch
L2: edge-judge — lint/compile gate → AUTO-ABORT on SYNTAX_ERROR/SCOPE_ESCAPE/DATA_HOLLOWING
L1: Workers — implementer, verifier(×2), fixer, discovery, architect (≤4K tokens, diff-only)
L0: Orchestrator — atomic split, dehydration, execution graph, transaction log
```

## Atomic Split

Each lane: one file cluster, one scope, zero overlap, dehydrated context.

Two lanes MUST NOT modify same file unless disjoint line ranges AND functionally decoupled.
Coupled → abstract interface first, then split.

## Execution Graph JSON Schema

```json
{
  "execution_graph": {
    "total_concurrent_lanes": "N",
    "lane_mode": "parallel | sequential | hybrid",
    "dependency_edges": [{"from":"A","to":"B","reason":""}],
    "lanes":[{
      "lane_id":"LANE-N",
      "target_file":"path",
      "target_scope":"Module.Func",
      "domain":"effect-ts|react-vite|generic",
      "isolated_context":{
        "signatures":["fn(a:T):R"],
        "interfaces":["type T = {...}"],
        "imports_direct":["import {X} from '...'"],
        "implementation_file_snippet":"[targeted lines, no comments]"
      },
      "mutation_instructions":"Imperative sentence.",
      "constraints":{"do_not_touch":[],"max_lines_changed":"N"},
      "expected_output":"Unified diff L##-L##"
    }]
  }
}
```

## Dehydration (before every worker spawn)

1. Strip all comments (`//`, `/* */`, `/** */`)
2. Non-target function bodies → signature only
3. Only direct imports (no transitive)
4. Implementation snippet: target scope ±20 lines
5. Total < 2,000 tokens per lane

## Worker Constraints

| Constraint | Rule |
|---|---|
| Token sandbox | ≤4,000 (system~800 + code~2,000 + instructions~300 + buffer~500) |
| Scope lock | No lines outside `target_scope` |
| No chat | Zero prose, zero markdown explanations |
| Diff-only | Unified diff or AST patch matrix only |
| No cross-talk | Unaware of other workers |

## Worker Output Format

```
<<<<< WORKER_OUTPUT
--- file
+++ file
@@ -L,C +L,C @@
[diff content]
===== WORKER_OUTPUT
```

## Aggregation (Fan-In)

1. AST Aggregator: N APPROVED patches → dependency matrix → detect collisions → consolidated patch
2. Global Judge: consolidated patch + instruction set → integrity score → APPROVED/NEEDS_REMEDIATION
3. Only APPROVED/APPROVED_WITH_NOTES → `mas-decision`

## Transaction Log

```json
{"workflow_id":"","domain":"","pipeline_mode":"dynamic","total_lanes":5,"lanes":[{"lane_id":"","target_file":"","target_scope":"","status":"APPROVED","edge_judge_verdict":"APPROVED","integrity_score":98,"confidence":"HIGH"}],"aggregation":{"merge_status":"SUCCESS","collisions_detected":0},"global_judgment":{"verdict":"APPROVED","integrity_score":96},"ship_judgment":"PENDING_USER_CONFIRMATION"}
```
