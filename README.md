# nyx

Three-agent ship-mas topology: discovery (file investigation), implementer (code changes), researcher (web research). Orchestrator handles design, verification, and reconciliation directly.

## Quick Start

```bash
git clone <repo-url> && cd nyx
./bootstrap.sh install
```

Syncs `opencode/` → `~/.config/opencode` and `agents/` → `~/.agents`. Load `ship-mas` mode in opencode.

## Architecture

| Plane | Role | Tools |
|---|---|---|
| L0 — Orchestrator | DAG scheduling, binary GATE, HITL | `task`, `bash` (restricted), `skill`, `grep`, `rg`, `wc` |
| L1 — Agents | File I/O, code transformation, analysis | `read`, `edit`, `glob`, `grep`, `bash`, `skill` — `task: deny` |

## Complexity Score

Computed by external script, never by the LLM:

```
node ~/.config/opencode/scripts/complexity-score.mjs --input '<json>'
```

Three-component weighted ensemble:

```
C_total = 0.44 · C_min_norm + 0.33 · (1 - Q) + 0.22 · avg_conductance
```

| Component | Measures |
|---|---|
| C_min_norm | Task graph bottleneck — how tightly coupled the work is |
| 1 - Q | Community separation — how well tasks cluster into groups |
| avg_conductance | Cluster boundary porosity — how cleanly groups separate |

H_norm (work distribution) and D_JS (domain divergence) are computed for routing flags only — they do not feed into C_total.

The script validates mathematical invariants: unique task IDs, non-negative deltas, symmetric adjacency, weights summing to 1.0, all component ranges. Violations throw descriptive errors.

## Workflow

```
User → ship-mas
  │ classify intent → pre-flight checks
  │ evidence gathering (MANDATORY): spawn discovery agent → cross-file coupling with file:line citations
  │ complexity-score.mjs → levels, routing, recommended
  │ for each level in levels:
  │   spawn all level tasks in parallel
  │   GATE: build verification + linting (binary — never averaged)
  │   FAIL → re-spawn implementer with corrected instructions → ESCALATE if persistent
  │   PASS → soft confidence (framing only)
  └─ HITL: pure presentation — no questions, no approval gate
```

## Invariants

- Orchestrator never analyzes code — every analytical task delegated to spawned agent
- No file modified by two parallel tasks (script-enforced disjointness)
- Binary GATE — never averaged with soft signals
- Implementer failures: max 3 re-spawn attempts with corrected instructions, then ESCALATE
- All sub-agents have `task: deny` (recursion lock)
- Sub-agent gets fresh context window — no parent conversation inheritance

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
