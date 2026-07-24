---
# nyx

OpenCode configuration implementing Multi-Agent Shipping (MAS) — a structured orchestrator for coordinating AI agents across complex, multi-file code changes. Uses information-theoretic complexity scoring, evidence-gated dependency graphs, and a binary GATE verification protocol. Features context-window preservation for long-running sessions.

## Quick Start

```bash
git clone <repo-url> && cd nyx
./bootstrap.sh install
```

Syncs `opencode/` → `~/.config/opencode` and `agents/` → `~/.agents`. Load `ship-mas` mode in opencode. Run `bootstrap.sh install` after any update to sync changes.

## Architecture

| Plane | Role | Tools |
|---|---|---|
| L0 — Orchestrator | DAG scheduling, binary GATE, HITL, failure diagnosis routing | `task`, `bash` (restricted allowlist), `skill` |
| L1 — Agents | File I/O, code transformation, analysis, diagnosis | `read`, `edit`, `glob`, `bash`, `skill` — `task: deny` (recursion lock) |

### Operational Thresholds

| C_total | Pipeline | Behavior |
|---------|----------|----------|
| < 0.25 | Fast lane | Skip evidence gathering. Go straight to implementer. |
| 0.25 — 0.60 | Normal | Full discovery → decomposition → parallel agents → GATE |
| > 0.60 | Full | Maximum caution. Extra verification. Conservative splitting. |

## Workflow

```
User → ship-mas
  │ classify intent → pre-flight checks
  │ The Ladder:
  │   1. Structure scan
  │   2. Evidence gathering: spawn discovery → file:line citations
  │   3. complexity-score.mjs → levels
  │   4. Level schedule from script stdout
  │   5. Plan validation
  │   6. Spawn per level: parallel within level, sequential across levels
  │   7. GATE: build + lint
  │   8. HITL: presentation with git diff + requirements mapping + confidence
  │
  │ Closed-loop failure path
  │   GATE FAIL → spawn DIAGNOSTICIAN
  │            → re-spawn implementer with diagnosis-informed instructions
  │            → if still fails → spawn DISCOVERY + RESEARCHER
  │            → synthesize → re-spawn with full context
  │            → if still fails → ESCALATE with failure history
  │
  │ Context preservation:
  │   After compaction → re-load all 5 skills via skill()
  │   When context feels tight → delegate more to sub-agents
  │   When instructions degrade → stop, re-read mode, re-load skills
  └─ No questions, no approval gate — pure presentation
```

## Invariants

- Orchestrator never analyzes code — every analytical task delegated to spawned agent
- No file modified by two parallel tasks (script-enforced disjointness)
- Binary GATE — never averaged with soft signals
- Closed-loop failures: diagnose → fix → if still fails → deeper diagnose → only then escalate
- Implementer failures: max 3 re-spawn attempts with corrected instructions, then ESCALATE
- All sub-agents have `task: deny` (recursion lock)
- Sub-agent gets fresh context window — no parent conversation inheritance
- Skills re-loaded after every compaction event

## References — Always respected who delivered this sense for generation

Each formula in ship-mas traces to established mathematical work. We apply them as-is, proven by their authors.

### Stoer & Wagner (1997) — Minimum Cut — [PAPER](https://doi.org/10.1145/263867.263872)

Information bottleneck in the task dependency graph. Identifies the smallest set of edges that separates the graph — where coordination cost is highest.

```math
C_{\text{min\_norm}} = \frac{\text{min-cut}(G)}{\max\text{-cut}}
```

### Newman & Girvan (2004) — Modularity — [PAPER](https://doi.org/10.1103/PhysRevE.69.026113)

Community separation quality of the level partition. Measures whether intra-cluster edges exceed random expectation. Higher modularity = better separation = lower complexity.

```math
Q = \frac{1}{2m}\sum_{ij}\left[A_{ij} - \frac{k_i k_j}{2m}\right]\delta(c_i, c_j)
```

### Kannan, Vempala & Vetta (2004) — Conductance — [PAPER](https://doi.org/10.1145/990308.990313)

Cluster boundary porosity. Measures how many edges cross a cluster boundary relative to its volume. Low conductance = clean cluster separation.

```math
\phi(S) = \frac{a(S, \bar{S})}{\min(\text{vol}(S), \text{vol}(\bar{S}))}
```

### Shannon (1948) — Entropy — [PAPER](https://doi.org/10.1002/j.1538-7305.1948.tb01338.x)

Work distribution across tasks. Used for routing flag only — does not feed into C_total.

```math
H_n = -\frac{\sum p_i \log_2 p_i}{\log_2 |V|}
```

### Lin (1991) — Jensen-Shannon Divergence — [PAPER](https://doi.org/10.1109/18.61115)

Domain separation between top-2 task domains. Used for routing flag only — does not feed into C_total.

```math
D_{JS} = \frac{1}{2}D_{KL}(P \parallel M) + \frac{1}{2}D_{KL}(Q \parallel M)
```

### Ebadulla et al. (2025) — Ensemble Validation — [arXiv](https://arxiv.org/abs/2507.07074)

Empirical validation of weighted ensemble for multi-agent complexity scoring. Our weights α=0.44, β=0.33, γ=0.22 follow their methodology.