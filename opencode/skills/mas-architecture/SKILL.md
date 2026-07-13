---
name: mas-architecture
description: MAS topology and atomic split rules for manifest generation. Conceptual definitions only — dehydration, worker constraints, and execution are handled by the TS Engine. Loaded by the task-decomposer.
---

## Topology

L4: TS Engine (mechanical core) — Validator, Dehydrator, Spawn Bridge, Gates (edge-judge, ast-aggregator, global-judge)
L3: Generic LLM Agents (discovery, architect, implementer, verifier, fixer) — no intrinsic domain knowledge
L2: spawn_manifest.json — declares all routing, phase chains, skill injections, context budgets
L1: task-decomposer — produces manifest from user request + codebase scan
L0: ship-mas mode — classifies intent, spawns decomposer, invokes run_manifest, presents HITL

## Atomic Split

Each DAG node: one file cluster, one scope, zero overlap. Two nodes MUST NOT modify the same file unless disjoint line ranges AND functionally decoupled, OR a dependency edge is declared (sequential execution). Coupled changes → abstract interface first (via architect phase), then split into separate nodes with a `type_contract_dependency` edge.

## Decomposer Declares vs Engine Executes

| Concept | Decomposer | Engine |
|---|---|---|
| Node definitions | `nodes[]` | Reads, dispatches mechanically |
| Phase chains | `phase_chain[]` per node | Executes verbatim in array order |
| Skill injection | `skills[]` per phase | Reads SKILL.md, injects into payload |
| Context tier | `context_tier` per phase | Dehydrates to declared tier |
| Token budget | `context_budget` per node | Enforces max_tokens per phase |
| Retry budget | `retry_budget` per node | Counts re-spins, escalates on exhaustion |
| Gates | `gates` in manifest | Runs edge-judge per node, ast-aggregator per level, global-judge terminal |
