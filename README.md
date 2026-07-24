# nyx

MAS orchestrator for opencode. Uses information-theoretic complexity
scoring (C_total), evidence-gated dependency graphs, tiered thinking budgets (500-12K tokens),
Delegation Gate, per-workspace Experience Registry, TECA overthink detection, and binary GATE
verification. Context-window preservation for long-running sessions.

## Quick Start

```bash
git clone <repo-url> && cd nyx
./bootstrap.sh install
```

Syncs `opencode/` → `~/.config/opencode` and `agents/` → `~/.agents`. Load `ship-mas` mode.
Run `bootstrap.sh install` after any update.

## Workflow

```
User → ship-mas
  │ classify intent → pre-flight checks
  │
  │ The Ladder:
  │   [!] 1. Structure scan
  │   [!] 2. Evidence gathering: spawn discoverer → file:line citations
  │   [!] 3. complexity-score.mjs → C_total + levels
  │   [ ] 4. Level schedule from script stdout
  │   [!] 5. Plan validation
  │   [ ] 6. Spawn per level: parallel within level, sequential across levels
  │   [ ] 7. GATE: build + lint (binary)
  │   [ ] 8. HITL: diff + requirements + confidence
  │   [!] = critical step (blocks progression)
  │
  │ Thinking tiers by C_total:
  │   < 0.25 → Quick (500)  0.25-0.60 → Moderate (2K)  > 0.60 → Complex (5K)
  │   Cross-crate → Deep (8K)  Hard cap: 12K per block
  │
  │ Delegation gate before each spawn:
  │   Parallelizable? Context gap? Verify cheaper? → YES = delegate
  │   NO to all → inline (15X token overhead)
  │
  │ Experience Registry → .opencode/experience-registry.json
  │
  │ Closed-loop failure:
  │   GATE FAIL → DIAGNOSTICIAN → re-spawn implementer (max 3)
  │            → if still fails → DISCOVERER + RESEARCHER → escalate
  │
  │ TECA before HITL:
  │   Check oscillation markers, hesitation markers, budget compliance
  │   RED on any → don't finalize → spawn agent
  │
  │ Context preservation:
  │   After compaction → re-load all 5 skills
  │   When tight → delegate more
  │   When degraded → re-read mode, re-load skills
  └─ No questions, no approval gate — pure presentation
```

## References

Always respected who delivered this sense for generation

- [Stoer & Wagner (1997)](https://doi.org/10.1145/263867.263872) — Minimum Cut


$$
C_{\text{min}} = \min_{S \subset V} \sum_{u \in S, v \notin S} w(u,v)
$$

- [Newman & Girvan (2004)](https://doi.org/10.1103/PhysRevE.69.026113) — Modularity


$$
Q = \frac{1}{2m}\sum_{ij}\left[A_{ij} - \frac{k_i k_j}{2m}\right]\delta(c_i, c_j)
$$

- [Kannan, Vempala & Vetta (2004)](https://doi.org/10.1145/990308.990313) — Conductance


$$
\phi(S) = \frac{\sum_{i \in S, j \notin S} w_{ij}}{\min(\text{vol}(S), \text{vol}(\bar{S}))}
$$

- [Shannon (1948)](https://doi.org/10.1002/j.1538-7305.1948.tb01338.x) — Entropy


$$
H = -\sum_{i} p_i \log_2 p_i
$$

- [Lin (1991)](https://doi.org/10.1109/18.61115) — Jensen-Shannon Divergence


$$
D_{\text{JS}} = \frac{1}{2}D_{\text{KL}}(P \parallel M) + \frac{1}{2}D_{\text{KL}}(Q \parallel M)
$$

- [Ebadulla et al. (2025)](https://arxiv.org/abs/2507.07074) — Ensemble Validation


$$
C_{\text{total}} = 0.44 \cdot C_{\text{min}} + 0.33 \cdot (1 - Q) + 0.22 \cdot \bar{\phi}
$$

- [Zhou et al. (2026)](https://arxiv.org/abs/2604.10739) — Overthinking in LLM Test-Time Compute


$$
P(\text{flip}) \propto \text{tokens}_{\text{thought}} \quad \text{for} \quad \text{tokens}_{\text{thought}} > 12\text{K}
$$

- [Li et al. (2026)](https://arxiv.org/abs/2602.03412) — Verified Critical Step Optimization


$$
|\text{critical}| \approx 0.16 \cdot |\text{steps}|
$$