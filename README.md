# nyx

Seven-agent topology: **discovery**, **architect**, **implementer**, **fixer**, **verifier**, **research**, **synthesis**. Two-layer architecture: a stateless orchestrator (ship-mas) applies evidence-gated, deterministic decomposition over task graphs using a hybrid ensemble complexity model (min-cut + modularity + conductance + entropy), then delegates execution to generic LLM agents with bounded retry, meta-cognition gating, satisficing confidence checks, TECA overthink detection, and a stack-agnostic mechanical verification GATE. No JSON manifests. No plugin engine. Built on OpenCode's staged topology (read-only researchers → synthesis → single writer → test → review).

## Quick Start

```bash
git clone <repo-url> && cd nyx
./bootstrap.sh install
```

Syncs `opencode/` → `~/.config/opencode` and `agents/` → `~/.agents`. Then load `ship-mas` mode in opencode.

## Architecture

| Plane | Role | Tool Access | Sandbox |
|---|---|---|---|
| **L0 — Orchestrator** | DAG scheduling, binary GATE, HITL, Discover fan-out | `task`, `bash` (restricted), `skill`, `question`, `todowrite`, `webfetch` | `read`/`glob`/`grep` denied |
| **L1 — Agents** | File I/O, code transformation, analysis | `read`, `edit`, `glob`, `grep`, `bash`, `skill` | `task: deny` (recursion lock) |

## Workflow: Change/Ship

```
User → ship-mas
  │ classify intent
  │ pre-flight checks (recursion lock, structure scan)
  │ evidence gathering (MANDATORY unless Fast Lane):
  │   spawn discovery agent → cross-file coupling report with file:line citations
  │   every file pair accounted for (evidence or explicit "none found")
  │ decompose → complexity-score.mjs:
  │   {"H_norm","D_JS","I_norm","C_T","routing","levels"}
  │   validates evidence completeness (missing citations → throws)
  │ The Ladder — Kahn's algorithm on evidence-cited edges:
  │   levels = complexity-score.mjs output
  │ for each level in levels:
  │   Plan validated? (sanity check on evidence completeness, file disjointness)
  │   spawn all level tasks in parallel same-turn
  │   GATE: project build verification and linting with tools determined by tech stack
  │         (binary — never averaged)
  │   FAIL → fixer (3-4 iterations with diversity, assertion weakening detection) → ESCALATE
  │   PASS → soft confidence (framing only, never affects ship)
  │   Semantic Gate (Layer 2): requirements-to-hunk mapping after binary GATE passes
  └─ HITL: pure presentation — no questions, no approval gate
       (diff + confidence shown to user; no feedback loop)
```

*The orchestrator never analyzes — it delegates every analytical task to spawned agents.*

## Workflow: Discover

```
User → ship-mas
  │ classify → Discover intent
  │ pre-flight checks
  │ structure scan
  │ count files in scope
  │ ≤ 15 files → single discovery agent → present
  │ > 15 files → fan out:
  │   cluster by top-level directory (structural only, no coupling claim)
  │   build tasks[] per cluster → **MANDATORY** complexity-score.mjs call
  │     (validates cluster structure, enforces deterministic boundaries)
  │   spawn one discovery agent per cluster (all same-level, parallel)
  │   spawn SYNTHESIS agent — reconciles cross-cluster findings
  └─ present to user
```

## Evidence Gating

Every edge between tasks MUST cite a discovery-verified file:line reference. The script enforces this:

- **Coupling pairs** with empty `evidence[]` → throws
- **Edges** with empty `evidence` → throws
- **Same-level tasks** with overlapping file sets → throws
- **Cycles** in DAG edges → throws

No citation → no assignment. The discovery agent produces citations — the orchestrator does not analyze; it delegates evidence gathering. Ambiguous cases (no evidence found, no evidence ruling out) default to **sequential** — not parallel-safe. Parallel-safe (**P-PARALLEL**) requires a positive confirmation of absence from discovery.

## Mathematical Model

### Task Graph

Work is modeled as a DAG $`G = (V, E)`$ where each $`v \in V`$ is an atomic task (one file cluster, one scope) and $`u \to v`$ encodes a dependency. Every edge must reference a discovery citation (file:line).

Level sets partition the graph via Kahn's algorithm:

```math
L_k = \{\, v \in V \mid \max_{u \to v} \text{depth}(u) = k \,\}
```

All vertices at the same level execute in parallel. Disjointness is invariant:

```math
\forall\, v_i, v_j \in L_k : \text{files}(v_i) \cap \text{files}(v_j) = \varnothing
```

### Complexity Score — Hybrid Ensemble

Computed by external script — never by the LLM:

```
node ~/.config/opencode/scripts/complexity-score.mjs --input '<json>'
```

Each task receives a delta weight $`\Delta \in \{0.5, 1.0, 2.0, 3.0\}`$ by scope and operation type. The composite complexity score is a weighted ensemble of four signals:

| Component | Source | Default Weight |
|-----------|--------|----------------|
| $`C_{\text{min\_norm}}`$ | Normalized minimum cut cost of task constraint graph (Stoer-Wagner algorithm). Measures information bottleneck when partitioning tasks across agents. | $`\alpha = 0.4`$ |
| $`1 - Q`$ | Complement of modularity score of the level partition. Higher modularity = well-separated communities = lower complexity. | $`\beta = 0.3`$ |
| $`\text{avg\_conductance}`$ | Mean conductance across all task clusters. Lower = better separation. | $`\gamma = 0.2`$ |
| $`C_T`$ | Legacy composite from $`(H_n + D_{JS} + I_{\text{norm}}) / k`$. Retained as auxiliary signal. | $`\delta = 0.1`$ |

**Ensemble formula:**

```math
C_{\text{total}} = \alpha \cdot C_{\text{min\_norm}} + \beta \cdot (1 - Q) + \gamma \cdot \text{avg\_conductance} + \delta \cdot C_T
```

Weights are learnable from empirical validation. Starting defaults: $`\alpha=0.4`$, $`\beta=0.3`$, $`\gamma=0.2`$, $`\delta=0.1`$.

The three legacy sub-components are retained for interpretability:

| Dimension | Formula | Meaning |
|---|---|---|
| Normalized entropy | $`H_n = -\dfrac{\sum p_i \log_2 p_i}{\log_2 \lVert V \rVert}`$ | Work distribution |
| Cross-domain divergence | $`D_{JS} = \frac{1}{2}D_{KL}(A \parallel M) + \frac{1}{2}D_{KL}(B \parallel M)`$ | Domain separation |
| Coupling proxy | $`I_{\text{norm}} = \min\!\left(1, \dfrac{\text{totalShared}}{\max(1, \text{maxPairs} \cdot 3)}\right)`$ | Evidence-gated heuristic (NOT Shannon mutual information) |

Where $`C_T = (H_n + D_{JS} + I_{\text{norm}}) / k,\quad k \in [1,3]`$.

**Input schema** (extended):

```json
{
  "tasks": [{ "id": "t1", "delta": 2.0, "files": ["src/a.ts"] }],
  "domains": { "t1": "frontend" },
  "coupling": [{ "a": "t1", "b": "t2", "sharedSymbols": 2, "evidence": ["a.ts:10"] }],
  "edges": [{ "from": "t2", "to": "t1", "reason": "P-BLOCKING: t1 imports from t2", "evidence": "src/a.ts:3" }],
  "graph": {
    "adjacency": [[0, 1, 0], [1, 0, 1], [0, 1, 0]]
  }
}
```

The optional `graph.adjacency` field provides an explicit N×N adjacency matrix. If omitted, the script infers it from `edges[]` and `coupling[]`.

**Output** includes all four ensemble components:

```
{ H_norm, D_JS, I_norm_coupling_proxy, C_T,
  C_min_norm, Q, avg_conductance, C_total,
  routing, levels }
```

### Scheduling (Level Sets)

Scheduling is driven by topological levels (computed by complexity-score.mjs via Kahn's algorithm over evidence-cited DAG edges), not by global routing flags. `edges[]` encode directional dependencies (**P-BLOCKING**) and same-file write conflicts (**P-WRITE**). **P-PARALLEL** pairs produce no edge. The orchestrator consumes these scheduling outputs — it never computes them; every analytical computation is delegated.

Level $`L_k`$ contains all tasks whose longest incoming path has length $`k`$. Tasks in the same level are **parallel-safe** (file disjointness proven, any overlap causes a script-level error). Tasks across levels are **sequential** — the orchestrator issues all $`L_k`$ tasks in one model turn, waits for all to return, then starts $`L_{k+1}`$.

```
levels = [["t1", "t2", "t4"], ["t3"]]

Turn N:   task(t1), task(t2), task(t4)   // parallel
          [wait for all]
Turn N+1: task(t3)                        // t3 depends on t1/t2
```

This enables mixed topologies: independent tasks run concurrently; dependent tasks run after their prerequisites.

### Routing (Informational)

The script also outputs informational routing flags from aggregate scores — these guide decomposition structure (splitting by cluster/domain) but do not directly drive per-task scheduling:

| Condition | Action |
|---|---|
| $`C_{\text{total}} < 0.25`$ AND $`\lVert V \rVert = 1`$ | Fast Lane |
| `!quick` prefix | Force Fast Lane ($`C_{\text{total}} = 0`$) |
| `splitByDomain` ($`D_{JS} > 0.15`$) | Split by domain before scheduling |
| `splitByFileCluster` ($`H_n > 0.70`$) | Split by cluster before scheduling |

### Meta-Cognition Gate (Gate 0)

Before any agent spawn, the orchestrator assesses task difficulty to allocate pipeline depth:

| Classification | Criteria |
|----------------|----------|
| **SIMPLE** | ≤2 target files AND ≤1 dependency AND description < 200 chars |
| **MEDIUM** | 3-5 target files OR 2-3 dependencies OR description 200-500 chars |
| **COMPLEX** | >5 target files OR >3 dependencies OR description >500 chars OR cross-domain |

| Difficulty | Analysis Steps | Implementers | Verifiers |
|------------|----------------|--------------|-----------|
| SIMPLE | 1 | 1 | 0 (satisficing only) |
| MEDIUM | 2 | 1-2 | 1 (if confidence < 0.8) |
| COMPLEX | Full pipeline | Per schedule | Full GATE |

### Satisficing Gate

After each implementer output, confidence determines downstream verification:

| Confidence | Action |
|------------|--------|
| $`> 0.80`$ | Ship — skip remaining verification steps |
| $`0.50 - 0.80`$ | Run 1 verifier pass, then re-check |
| $`< 0.50`$ | Run full verification pipeline |

Satisficing never overrides the binary GATE — it only gates downstream verification effort.

### TECA Overthink Detection

TECA (Token Entropy Consumption Analysis) monitors agents for flat information output:

- Track token-type entropy in rolling 200-token windows
- If entropy is flat ($`< 2\%`$ variance) for $`> 50\%`$ of budget → signal OVERHEAT
- On OVERHEAT: terminate agent, stash partial output, re-route with tighter scope

### Human Handoff Framework

When uncertainty exceeds thresholds, the orchestrator decides between analyzing more and asking the user:

| Condition | Action |
|-----------|--------|
| Uncertainty $`> 0.7`$ AND steps $`< 3`$ | Analyze more — spawn additional discovery |
| Uncertainty $`> 0.7`$ AND steps $`\ge 3`$ | **ASK USER** — present findings, options, recommendation |
| Uncertainty $`< 0.3`$ | Proceed (satisficing) |
| $`0.3 \le`$ uncertainty $`\le 0.7`$ | One more step, then re-evaluate |

### Integrity Formula

Per-level hunk integrity after GATE:

```math
C_{gj} = 1 - \frac{\text{unmatched\_hunks}}{\text{total\_hunks}}
```

Where $`C_{gj}`$ measures alignment between GATE output and task requirements at level $`j`$. Unmatched hunks are code changes present but not covered by any requirement citation. Used to detect hallucination and scope creep.

### Soft Confidence

Computed only after binary GATE passes (stack-agnostic — uses whichever verification tools were selected by tech stack detection). Framing only — never affects ship/no-ship:

```math
C_{\text{soft}} = \frac{1}{2}\left(\frac{\text{cited}}{\text{total}} + \left(1 - \frac{\text{unmatched\_hunks}}{\text{total\_hunks}}\right)\right)
```

| Score | Level | Framing |
|---|---|---|
| $`\geq 0.80`$ | HIGH | No caveats |
| $`0.50`$–$`0.80`$ | MEDIUM | Verify areas |
| $`< 0.50`$ | LOW | Low citation coverage |

## Graduated Verdicts

Binary GATE (pass/fail) still determines ship/no-ship. However, after binary GATE passes and semantic gate runs, a graduated verdict provides advisory signal:

| Verdict | Condition | Meaning |
|---|---|---|
| **PASS** | Binary GATE pass, $`C_{gj} \geq 0.8`$ | Full integrity — no caveats |
| **CONDITIONAL** | Binary GATE pass, $`0.5 \leq C_{gj} < 0.8`$ | Ship allowed but flagged — review untraced hunks |
| **REJECT** | Binary GATE pass, $`C_{gj} < 0.5`$ | Level fails despite binary pass — semantic integrity too low |

Graduated verdicts are **advisory only** — they inform HITL presentation and soft confidence but do not override the binary GATE. The binary GATE blocks unconditionally; graduated verdicts refine the framing when binary GATE passes.

## Invariants

- The orchestrator never analyzes code or data — every analytical task is delegated to a spawned agent
- No file modified by two parallel tasks (disjointness proven by script; separate git worktrees for parallel writers)
- Every agent has domain context (`skill()` before file access)
- No code ships without compilation (binary GATE — never averaged with soft signals)
- No infinite loops (fixer: 3-4 iterations with diversity, then ESCALATE)
- HITL is pure presentation — no questions, no approval gate
- Pre-flight recursion lock: all sub-agents have `task: deny`
- Cross-cutting concerns (security, testing, a11y, perf) flagged automatically — never silently skipped

## Red Lines

These are hard constraints — violations halt execution immediately:

1. **Plan Validation**: Every level must pass a sanity check (evidence completeness, file disjointness, no dangling citations) before any task in that level spawns. A failed plan validation is a hard abort — not a retry.

2. **Per-level Combined GATE**: Each level's verification runs as a single combined GATE after all parallel tasks return. Individual task-level gates are not evaluated in isolation — the level passes or fails as a unit.

3. **Assertion Weakening Detection**: Before fixer iteration 1, capture a baseline config (compiler flags, lint rules, test framework). After each fixer iteration, diff the baseline against current configuration. Any removal or relaxation of assertions (rule downgrades, flag removals, test skips) triggers immediate ESCALATE — the fixer must not weaken guardrails.

4. **Semantic Gate (Layer 2)**: After binary GATE passes, a semantic gate maps requirements to hunks. Every hunk must trace to at least one requirement citation. Untraced hunks drop integrity per $`C_{gj}`$ formula. A level with $`C_{gj} < 0.5`$ at semantic gate fails the level despite a passing binary GATE.