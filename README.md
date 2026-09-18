# nyx

MAS orchestrator for opencode. Model inherits runtime default; 7 custom agent defs: primary `ship-mas` + 6 subagents (discoverer, researcher, planner, implementer, tester, diagnostician). Context-window preservation via file-disjoint Kahn/CPM scheduling and an exit-0 gate.

## Quick Start

```bash
git clone https://github.com/datnguyennnx/nyx && cd nyx
./bootstrap.sh install
```

Syncs `opencode/` → `~/.config/opencode` and `.agent/` → `~/.agents/skills/`. Re-run after any update. One-direction only: this repo is the single source of truth; never sync global back to repo.

## Dependencies

### gthings (browser automation, search, PDF extraction)

```bash
cargo install gthings
```

Requires Rust 1.85+ and a Chromium-based browser running with `--remote-debugging-port=9222`. gthings skill files are managed by `gthings update`, not by `bootstrap.sh`.

## Workflow

```
User → ship-mas: Step 0/7 — Ground+Classify
  │ Step 1/7 — Scan (structure + evidence: discoverer → file:line)
  │ Step 2/7 — Plan (Kahn levels + CPM, P-WRITE serial)
  │ Step 3/7 — Spawn (pull, WIP ≤2)
  │ Step 4/7 — GATE (tester runs both validators; both block)
  │ Step 5/7 — Sufficiency (acceptance assertions + S-N/file:line)
  │ Step 6/7 — Auto Report
  │ HITL gates (legal pause points): HITL-1 scope+route · HITL-2 plan+acceptance
  │   · HITL-3 first write · HITL-4 first GATE failure · HITL-5 accept before ship
  │   · HITL-6 destructive operations
  │ WIP≤2: discoverer/researcher → planner → implementer → tester → diagnostician/researcher
  │ Delegate if parallelizable / context gap / verify cheaper; else inline
  │ FAIL → diagnostician → retry implementer (max 3) → discoverer + researcher → escalate
  │ Backpressure: oscillation / hesitation / budget RED → don't finalize
  │ Context: after compaction re-load skills; when tight delegate; when degraded re-read mode
  └─ a declared HITL gate is a legal pause point, not a failure
```

## Math Models

*Each model states the invariant its mechanism enforces.*

- **Well-founded decomposition** [1] — a task graph is schedulable if and only if acyclic; a cycle halts instead of emitting.

$$
\text{schedulable}(G) \iff \text{acyclic}(G), \qquad \text{cyclic}(G) \Rightarrow \text{halt}
$$

- **Level disjointness** [2] — writers in one level claim disjoint files, so concurrent writes cannot collide.

$$
\forall L, \forall a,b \in L : a \ne b \Rightarrow \text{write}(a) \cap \text{write}(b) = \varnothing
$$

- **Critical-path bound** [3] — makespan is at least the longest dependency chain; positive slack marks what may slip.

$$
T \ge \max_{p \in \Pi} \sum_{t \in p} d(t), \qquad \text{slack}(t) > 0 \Rightarrow t \text{ may slip}
$$

- **WIP cap** [4] — capping concurrency at two bounds in-flight work, and Little's Law then bounds latency.

$$
L = \lambda W, \qquad W \le 2 \;\Rightarrow\; L \le 2\lambda
$$

- **Gate conjunction** [5] — ship requires every blocking predicate; one failure blocks.

$$
\text{ship} \iff \bigwedge_{i} P_i, \qquad \neg P_k \Rightarrow \neg \text{ship}
$$

- **Maker-checker independence** [6] — an independent verifier makes false accept the product of two error rates, far below either alone.

$$
P(\text{false accept}) = \epsilon_{maker} \cdot \epsilon_{checker} \ll \min(\epsilon_{maker}, \epsilon_{checker})
$$

- **Clean-context re-spawn** [7] — inherited context accumulates error linearly in the attempt index; a clean restart does not.

$$
e_n^{inh} \le n\epsilon \qquad \text{versus} \qquad e_n^{clean} = \epsilon
$$

- **Bounded retry** [8] — a finite attempt cap terminates the failure feedback edge instead of looping.

$$
n \le N_{max} < \infty \Rightarrow \text{the failure edge terminates}
$$

- **Sufficiency** [9] — the gate passes if and only if every declared assertion is matched; partial coverage fails.

$$
\text{gate} \iff \forall a \in A_{decl} : \text{match}(a), \qquad A_{matched} \subset A_{decl} \Rightarrow \neg \text{gate}
$$

- **Budget** [10] — total spend is bounded by the sum of per-spawn token caps.

$$
\text{spend} \le \sum_{i=1}^{n} \text{cap}_i
$$

## References

1. [Kahn (1962)](https://doi.org/10.1145/368996.369025) — topological order.
2. [Cognition (2025)](https://cognition.com/blog/dont-build-multi-agents) — single-threaded writers.
3. [Kelley & Walker (1959)](https://doi.org/10.1145/1460299.1460318) — critical path.
4. [Little (1961)](https://doi.org/10.1287/opre.9.3.383) — Little's Law.
5. [Jimenez et al. (2023)](https://arxiv.org/abs/2310.06770) — execution-grounded grading.
6. [McAleese et al. (2024)](https://arxiv.org/abs/2407.00215) — independent critic.
7. [Anthropic (2026)](https://www.anthropic.com/engineering/harness-design-long-running-apps) — context resets, structured handoff.
8. [LangChain (2025)](https://www.langchain.com/blog/fault-tolerance-in-langgraph) — bounded retry, recursion limit.
9. [Setlur et al. (2024)](https://arxiv.org/abs/2410.08146) — step-level process verification.
10. [Anthropic (2025)](https://www.anthropic.com/engineering/multi-agent-research-system) — effort scaled to task complexity.
11. [Blumofe & Leiserson (1999)](https://doi.org/10.1145/324133.324234) — work stealing.
12. [Tassiulas & Ephremides (1992)](https://doi.org/10.1109/18.61115) — backpressure.

## Permissions

Shell rules match per resource and the LAST match wins, so the broad `ask` sits first and the specific denies follow.
Nothing is pre-approved.
An unlisted command prompts the operator.
A listed command is refused with no prompt.

| Shell resource | Effect | Meaning for an agent |
| --- | --- | --- |
| `*` | ask | every command prompts the operator; nothing runs silently |
| `rm *` | deny | destructive filesystem: refused with no prompt |
| `rmdir *` | deny | destructive filesystem: refused with no prompt |
| `mv *` | deny | destructive filesystem: refused with no prompt |
| `dd *` | deny | destructive filesystem: refused with no prompt |
| `truncate *` | deny | destructive filesystem: refused with no prompt |
| `shred *` | deny | destructive filesystem: refused with no prompt |
| `chmod *` | deny | destructive filesystem: refused with no prompt |
| `chown *` | deny | destructive filesystem: refused with no prompt |
| `curl *` | deny | network egress: refused with no prompt |
| `wget *` | deny | network egress: refused with no prompt |
| `nc *` | deny | network egress: refused with no prompt |
| `ssh *` | deny | network egress: refused with no prompt |
| `scp *` | deny | network egress: refused with no prompt |
| `git clean *` | deny | destructive git: refused with no prompt |
| `git reset *` | deny | destructive git: refused with no prompt |
| `git checkout *` | deny | destructive git: refused with no prompt |
| `git restore *` | deny | destructive git: refused with no prompt |
| `git -C *` | deny | destructive git: refused with no prompt |
| `python *` | deny | interpreter one-liner: refused with no prompt |
| `python3 *` | deny | interpreter one-liner: refused with no prompt |
| `sh -c *` | deny | interpreter one-liner: refused with no prompt |
| `bash -c *` | deny | interpreter one-liner: refused with no prompt |

`node` is deliberately not refused: the validator scripts are `node` invocations and must be runnable, so `node` prompts instead.