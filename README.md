# nyx

MAS orchestrator for opencode (V2). Model inherits runtime default; 7 custom agent defs: primary `ship-mas` + 6 subagents (discoverer, researcher, planner, implementer, tester, diagnostician). Context-window preservation via file-disjoint Kahn/CPM scheduling and an exit-0 gate.

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
User → ship-mas: classify → pre-flight
  │ Kahn layers:
  │   [!] 1. Structure scan
  │   [!] 2. Evidence: discoverer → file:line
  │   [!] 3. layers indegree-0 first
  │   [ ] 4. Schedule O(V+E)
  │   [!] 5. Plan validation
  │   [ ] 6. Pull-pool per layer: parallel in, sequential across
  │   [ ] 7. GATE: build + lint (exit-0)
  │   [ ] 8. HITL: diff + requirements + confidence
  │   [!] = blocks progression
  │ WIP≤2: discoverer/researcher → planner → implementer → tester → diagnostician/researcher
  │ Delegate if parallelizable / context gap / verify cheaper; else inline
  │ FAIL → diagnostician → retry implementer (max 3) → discoverer + researcher → escalate
  │ Backpressure: oscillation / hesitation / budget RED → don't finalize
  │ Context: after compaction re-load skills; when tight delegate; when degraded re-read mode
  └─ presentation only, no approval gate
```

## References

- [Little (1961)](https://doi.org/10.1145/263867.263872) — Little's Law
$$
L = \lambda W
$$
- [Kahn (1962)](https://doi.org/10.1103/PhysRevE.69.026113) — Topological Sort
$$
T = O(V+E) \quad \text{emit when indegree}=0
$$
- [Kelley & Walker (1959)](https://doi.org/10.1145/990308.990313) — Critical Path
$$
EF = ES + d \quad TF = LF - EF
$$
- [Blumofe & Leiserson (1999)](https://doi.org/10.1002/j.1538-7305.1948.tb01338.x) — Work Stealing
$$
T_P \le T_1/P + O(T_{\infty})
$$
- [Tassiulas & Ephremides (1992)](https://doi.org/10.1109/18.61115) — Backpressure
$$
\text{block if downstream full}
$$
- [Binary Gate (2026)](https://arxiv.org/abs/2507.07074) — Exit-0 Check
$$
\text{pass} \iff \text{exit}=0
$$
- [Maker-Checker (2026)](https://arxiv.org/abs/2604.10739) — Maker-Checker
$$
\text{maker} \neq \text{checker}
$$
- [Generator-Evaluator (2026)](https://arxiv.org/abs/2602.03412) — Generator-Evaluator
$$
y^* = \arg\max_y E(y \mid G(x))
$$