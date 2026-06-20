---
name: mas-decision
description: Ship judgment framework. Decision matrix from subagent evidence, multi-domain
verdict combination, formal confidence formula. Loaded by all ship orchestrators.
---

## Decision Matrix

| Review Verdict | Condition | Ship Judgment |
|---|---|---|
| READY TO SHIP | All agents VALID, no gaps, no conflicts | Safe to ship |
| READY TO SHIP | Minor gaps, no blocking | Safe to ship with follow-up |
| NEEDS FIXES | Blocking issues (Blocking? = YES) | Not ready to ship |
| NEEDS FIXES | Non-blocking only | Safe to ship with follow-up |
| NEEDS FIXES | Ambiguous | Not ready to ship |
| NOT READY TO SHIP | Any reason | Not ready to ship |

## Multi-Domain Verdict Combination

| Backend | Frontend | Boundary | Ship Judgment |
|---|---|---|---|
| READY TO SHIP | READY TO SHIP | PASS | Safe to ship |
| READY TO SHIP | NEEDS FIXES | PASS | Safe to ship with follow-up |
| NEEDS FIXES | * | — | Not ready to ship |
| * | NEEDS FIXES | — | Not ready to ship |
| NOT READY TO SHIP | * | — | Not ready to ship |
| * | NOT READY TO SHIP | — | Not ready to ship |
| * | * | FAIL | Not ready to ship |

## Confidence Formula

```
C = α·C_cit + β·C_ver + γ·C_gj
α = β = γ = 1/3
```

| Component | Source | Formula |
|---|---|---|
| C_cit | verifier | `cited_changes / total_changes` |
| C_ver | verifiers | 1.0 both PASS, 0.5 mixed, 0.0 both FAIL |
| C_gj | global-judge | `integrity_score / 100` |

Unavailable component → redistribute its weight equally: `w_i = 1/k`.

### Level Mapping

| C Range | Level | Action |
|---|---|---|
| C ≥ 0.80 | HIGH | Safe to ship |
| 0.50 ≤ C < 0.80 | MEDIUM | Ship with caveats |
| C < 0.50 | LOW | Escalate — do not auto-ship |
