---
name: mas-architecture
description: 5-layer MAS topology: Orchestrator→Workers→EdgeJudge→ASTAggregator→GlobalJudge. Atomic split, Dehydrate-Hydrate, execution graph JSON schema, pipeline modes, transaction log format. Loaded by all ship orchestrators.
---

## 5-Layer Architecture

```
L5: Codebase (filesystem)
L4: global-judge — requirements-mutation check → APPROVED/APPROVED_WITH_NOTES/NEEDS_REMEDIATION
L3: ast-aggregator — diff merge, dependency matrix, collision detection → consolidated patch
L2: edge-judge — lint/compile gate, SYNTAX_ERROR/SCOPE_ESCAPE/DATA_HOLLOWING → AUTO-ABORT
L1: Workers — implementer, verifier(×2), fixer, discovery, architect, review (≤4K tokens, diff-only)
L0: Orchestrator (*-ship, task-coordinator) — atomic split, dehydration, execution graph, transaction log
```

## Atomic Split (Layer 0)

Decompose objective into N independent lanes. Each lane: one target file/cluster, one scope, zero overlap, dehydrated context.

Two lanes MUST NOT modify same file unless disjoint line ranges and functionally decoupled. If coupled → abstract interface first, then split.

## Execution Graph JSON Schema

```
{
  "execution_graph": {
    "total_concurrent_lanes": N,
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
      "constraints":{"do_not_touch":[],"max_lines_changed":N},
      "expected_output":"Unified diff L##-L##"
    }]
  }
}
```

### Dehydration (MUST before every worker spawn)
1. Strip all comments (`//`, `/* */`, `/** */`)
2. Non-target function bodies → signature only
3. Only direct imports (no transitive)
4. Implementation snippet: target scope ±20 lines only
5. Total < 2,000 tokens per lane

## Pipeline Modes

**Linear** (<5 files, coupled):
`Orchestrator → Discovery → Architect → Implementer → Verifier(×2) → Fixer → Edge Judge → AST Aggregator → Global Judge → mas-decision → HITL`

**Dynamic** (>10 files, independent):
`Orchestrator → N×(TaskCoordinator[Imp→Ver×2→Fixer→Edge]) → AST Aggregator → Global Judge → mas-decision → HITL`

**Hybrid**: coupled tasks linear + independent tasks dynamic → AST Aggregator → Global Judge

## Worker Constraints

| Constraint | Rule |
|---|---|
| Token sandbox | ≤4,000 (system~800 + code~2,000 + instructions~300 + buffer~500) |
| Scope lock | No lines outside `target_scope` |
| No chat | Zero prose, zero markdown explanations |
| Diff-only | Unified diff patch or AST patch matrix only |
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

1. AST Aggregator: collect N APPROVED patches → dependency matrix → detect collisions → resolve → consolidated patch
2. Global Judge: consolidated patch + instruction set → integrity score → APPROVED/NEEDS_REMEDIATION
3. Only APPROVED/APPROVED_WITH_NOTES → mas-decision. NEEDS_REMEDIATION → targeted re-spin (not full restart)

## Transaction Log (Orchestrator State)

Orchestrator holds high-density JSON log, NOT source code:
```
{"workflow_id":"","domain":"","pipeline_mode":"dynamic","total_lanes":5,"lanes":[{"lane_id":"","target_file":"","target_scope":"","status":"APPROVED","edge_judge_verdict":"APPROVED","integrity_score":98,"confidence":"HIGH"}],"aggregation":{"merge_status":"SUCCESS","collisions_detected":0},"global_judgment":{"verdict":"APPROVED","integrity_score":96},"ship_judgment":"PENDING_USER_CONFIRMATION"}
```

## Companion Skills

`mas-integrity` `mas-workflow` `mas-aggregation` `mas-decision` `mas-feedback`

## Subagent Agents

`edge-judge` `ast-aggregator` `global-judge` `task-coordinator` + domain implementers/verifiers/fixers
