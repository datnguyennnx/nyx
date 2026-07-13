---
name: mas-decomposition
description: Task decomposition, complexity scoring, DAG routing, fast-lane threshold. For ship-mas orchestrator.
---

## Topology

L0: ship-mas — classifies intent, decomposes, spawns agents, verifies, presents HITL
L1: Generic agents (discovery, architect, implementer, verifier, fixer) — direct tool access, domain skills via `skill` tool

## Atomic Split

Each task: one file cluster, one scope, zero overlap with other parallel tasks. Coupled changes → abstract interface first (architect), then sequential spawn.

## Complexity Scoring

Delta: new file>50w=3.0, new file<=50w=2.0, edit>50w=2.0, edit<=50w=1.0, rename/typo=0.5
H(T) = -sum(p_i * log2(p_i)), p_i = Delta_i / sum(Delta_j)
H_norm = H(T)/log2(n) for n>1, 0 for n=1. [0,1]
D_JS = 0.5*D_KL(P_A||M) + 0.5*D_KL(P_B||M). 0 for single-domain. [0,1]
I(U_j;U_k) = H(U_j)+H(U_k)-H(U_j,U_k). I_norm = max(I)/H(T), capped 1.0. I>0 → sequential.
C(T) = (H_norm + D_JS + I_norm) / k. k=active components (1-3). [0,1]

## Fast Lane

tau=0.25. Fast Lane: C(T)<tau AND |task_set|=1 AND |files|<=2. `!quick` prefix → C(T)=0, force fast-lane.

## Decomposition (C(T) >= 0.25)

| Condition | Action |
|---|---|
| H_norm > 0.70 | Split by file cluster |
| \|task_set\| > 1 | Honor natural boundaries |
| I_norm > 0 | Sequential spawn |
| D_JS > 0.15 | Split by domain (frontend/backend separate) |

n_max = ceil(2^H_norm)+1 files per task. I>0 → sequential, I=0 → parallel-safe.

## Edge Classification

| Priority | Condition | Direction |
|---|---|---|
| P1 | Both touch shared type file AND one exports type other imports | exporter → importer |
| P2 | Both touch same Layer | smaller → larger |
| P3 | A imports from B's files | B → A |
| P4 | A consumes B's export type | B → A |
| P5 | Different domains, no imports | Parallel-safe |
| P6 | Same file, disjoint ranges | Sequential |

## False-Independence Anti-Patterns

Shared types, DB migrations, Effect layers, cross-domain type drift, same-file parallel edits → all require sequential spawning.
