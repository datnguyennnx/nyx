# nyx

Two-layer architecture: a stateless orchestrator (ship-mas) applies information-theoretic decomposition over task graphs, then delegates execution to generic LLM agents with bounded retry and mechanical verification gates. No JSON manifests. No plugin engine.

## Architectural Abstraction

The system separates two concerns that monolithic agent frameworks conflate:

**Control plane (L0)** — ship-mas owns the DAG: intent classification, complexity scoring, task decomposition, dependency resolution, agent dispatch, build verification, escalation policy. It reads no source files. It writes no code. It is a pure scheduler with mechanical gates.

**Execution plane (L1)** — generic agents own semantics: reading code, applying transformations, self-verifying. They are interchangeable, stateless beyond a single task, and domain-instrumented via skill injection at spawn time.

The interface between planes is the `task` tool. The orchestrator never interprets agent output — only checks compilation and lint exit codes.

| Concern | Owner | Verification |
|---|---|---|
| What to do | ship-mas (C(T) decomposition) | N/A |
| How to do it | Agent (loaded skills) | `tsc --noEmit`, `eslint` |
| Whether it compiles | ship-mas (mechanical gate) | Exit code |
| Whether it's correct | Verifier agent (advisory) | Citation coverage ≥ 0.6 |

## Myths

| Myth | Reality |
|---|---|
| "LLM output is probabilistic and unreliable." | The orchestrator never relies on probabilistic output for correctness. It decomposes by Shannon entropy, verifies by compiler exit code, and bounds retries by fixed-point iteration (max 2). The LLM only operates within a sandbox of mechanical gates. |
| "Adding agents increases failure modes." | Agents are embarrassingly parallel — they operate on disjoint file clusters (proven by set intersection). The DAG guarantees acyclic execution. Fix loops are bounded. The system converges or escalates; it does not oscillate. |
| "You need human supervision." | HITL is a final gate, not a steering wheel. Feedback is classified into 5 deterministic re-entry patterns. Loops are bounded at 3 with geometric decay — beyond the 4th, noise dominates signal and the system pauses. |
| "Domain knowledge must be hardcoded." | Skills are injected dynamically by naming convention + keyword matching. Adding a new domain skill requires zero changes to the orchestrator — it discovers available skills from context at runtime. |

## Mathematical Model

### Task Graph

The orchestrator models work as a directed acyclic graph G = (V, E) where each vertex v ∈ V is an atomic task (one file cluster, one scope) and each edge u → v encodes a dependency.

Level sets partition the graph:

$$L_k = \{\, v \in V \mid \max_{u \to v} \text{depth}(u) = k \,\}$$

All vertices at the same level execute in parallel. Disjointness is invariant:

$$\forall\, v_i, v_j \in L_k : \text{files}(v_i) \cap \text{files}(v_j) = \varnothing$$

### Complexity Score

Each task receives a delta weight Δ ∈ {0.5, 1.0, 2.0, 3.0} based on scope size and operation type. The probability mass function over a task set is:

$$p_i = \frac{\Delta_i}{\sum_j \Delta_j}$$

Three orthogonal complexity dimensions are computed:

| Dimension | Formula | Meaning |
|---|---|---|
| Normalized entropy | $H_n = -\frac{\sum p_i \log_2 p_i}{\log_2 \|V\|}$ | How evenly work is distributed |
| Cross-domain divergence | $D_{JS} = \frac{1}{2}D_{KL}(A\|M) + \frac{1}{2}D_{KL}(B\|M)$ | How much domains differ |
| Mutual information | $I_n = \frac{\max_{j\neq k} I(U_j;U_k)}{H(T)}$ | How coupled tasks are |

Composite score:

$$C(T) = \frac{H_n + D_{JS} + I_n}{k},\quad k \in [1,3]$$

### Routing Policy

| Condition | Route |
|---|---|
| C(T) < 0.25 AND \|V\| = 1 AND \|files\| ≤ 2 | Fast Lane — single agent, no fix loop |
| `!quick` prefix | Force Fast Lane (C = 0) |
| I_n > 0 | Sequential spawn (dependency exists) |
| D_{JS} > 0.15 | Split into separate domain pipelines |
| H_n > 0.70 | Split by file cluster |

### Convergence

Fix loop: `iterations ≤ 2` else ESCALATE.
HITL loop: `iterations ≤ 3` else PAUSE (4th iteration signal-to-noise ratio δ₄ < 0.07·δ₀).

### Ship Confidence

$$C_{\text{ship}} = \frac{1}{3}\left(\frac{\text{cited}}{\text{total}} + C_{\text{ver}} + \frac{\text{integrity}}{100}\right)$$

Decision boundary: ≥ 0.80 ship, 0.50–0.80 caveats, < 0.50 escalate.

## Execution Model

```
User → ship-mas
  │ classify intent
  │ structure scan (ls/find — no file contents)
  │ compute C(T)
  │ decompose into levels L₀, L₁, ...
  │
  │ for each level:
  │   spawn agents via task() in parallel
  │     each agent: read files → apply skills → write code → self-verify
  │   run tsc --noEmit + eslint
  │   if FAIL → spawn fixer (max 2) → ESCALATE
  │
  └─ HITL: present diff + verification + confidence
       approve → ship
       feedback → re-enter (max 3)
```

### Per-Task Pipeline

```
discover → architect → implement → verify → [fix] → done
```

Fast Lane: `implement → verify` (single task, ≤2 files, C < τ).

## Invariants

| Invariant | Enforcement |
|---|---|
| No file is modified by two parallel tasks | Set disjointness proven at decomposition |
| No agent reads orchestrator configuration | ship-mas denies `read`/`glob`/`grep` to itself |
| Every agent has domain context | `skill` tool loaded before any file access |
| No code ships without compilation | `tsc --noEmit` exit code is absolute gate |
| No infinite loops | Fix ≤ 2, HITL ≤ 3, escalation on exhaustion |
| Skills are discoverable, not hardcoded | ship-mas matches `{domain}-{concern}` convention |

## Layers

| Layer | Responsibility | Tool Access |
|---|---|---|
| **L0 — Orchestrator** | DAG scheduling, verification, HITL | `task`, `bash` (restricted), `skill`, `question`, `todowrite` |
| **L1 — Agents** | File I/O, code transformation, analysis | `read`, `edit`, `glob`, `grep`, `bash`, `skill` |
