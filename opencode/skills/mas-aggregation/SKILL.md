---
name: mas-aggregation
description: Output format validation, evidence quality, conflict and gap detection heuristics. Conceptual definitions for the TS Engine's ast-aggregator and global-judge. Loaded by the task-decomposer and generic agents via injection.
---

## Format Validation

| Agent | Required Output Sections |
|---|---|
| discovery | Findings, Boundary Map, Dependency Graph, Assumptions |
| architect | Assessment, Recommendations, Handoff Table, Verdict |
| implementer | Changes Table, Change Details, Boundary Check, Verification Notes |
| verifier | JSON verdict with violations array, citation_coverage, metadata |
| fixer | Fixes Applied Table, Scope Compliance, Corrected Implementation Summary |

Missing sections → engine flags invalid, re-spawns agent (up to retry_budget).

## Evidence Quality

Confidence: HIGH = direct file:line in diff/context, MEDIUM = inferred from patterns, LOW = speculative.
Severity: HIGH = blocking/breaking/security/crash, MEDIUM = degrading, LOW = cosmetic.

## Conflict Detection (ast-aggregator)

| Pattern | Collision Class | Action |
|---|---|---|
| Two nodes modify same file, no declared edge | LINE_OVERLAP | ISOLATE |
| Node A removes import that node B references | IMPORT_CONFLICT | ISOLATE or resolve |
| Node A changes export signature, node B calls old | SIGNATURE_DIVERGENCE | ISOLATE or resolve |
| Node B depends on A, but A not yet applied | ORDERING_VIOLATION | Re-order |

## Gap Detection (global-judge)

| Gap | Detection | Consequence |
|---|---|---|
| R-ID not in any `satisfies[]` | Coverage map | MISSING_REQUIREMENT |
| Satisfying node has no APPROVED diff touching acceptance_files | Coverage map | MISSING_REQUIREMENT |
| Diff touches file not in any `target_files` | Set comparison | UNPLANNED_CHANGE |
| Diff touches symbol not in any `touches_symbols` | Symbol comparison | UNPLANNED_CHANGE |

## Task Confidence Rollup

`C_workflow = (1/N) · Σ C_i`. ≥0.80 HIGH, 0.50-0.80 MEDIUM, <0.50 LOW, any UNRESOLVABLE_ANOMALY → BLOCKED.
