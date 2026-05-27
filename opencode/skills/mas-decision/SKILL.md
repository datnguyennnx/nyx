---
name: mas-decision
description: Ship judgment framework. Maps subagent evidence to ship decisions using a decision matrix with confidence levels and verdict combination rules. Loaded by all ship orchestrator agents.
---

# MAS Decision Framework

This skill defines HOW an orchestrator converts aggregated subagent evidence into a ship judgment. It does NOT aggregate — that's `mas-aggregation`. It does NOT classify tasks or delegate — that's the ship agent's responsibility.

---

## Decision Matrix

Map review agent verdicts to ship judgments:

| Review Verdict | Condition | Ship Judgment |
|---|---|---|
| READY TO SHIP | All agents: format VALID, no gaps, no conflicts | **Safe to ship** |
| READY TO SHIP | Minor gaps (LOW confidence findings) exist but no blocking issues | **Safe to ship with explicit follow-up** |
| NEEDS FIXES | Blocking issues flagged by review (Blocking? = YES) | **Not ready to ship** |
| NEEDS FIXES | Non-blocking issues only (Blocking? = NO for all) | **Safe to ship with explicit follow-up** |
| NEEDS FIXES | Ambiguous — can't tell if issues are blocking | **Not ready to ship** — escalate to user |
| NOT READY TO SHIP | Any reason | **Not ready to ship** — ALWAYS |

---

## Multi-Domain Verdict Combination

When coordinating multiple domains (fullstack-ship), combine verdicts:

| Backend Verdict | Frontend Verdict | Boundary | Ship Judgment |
|---|---|---|---|
| READY TO SHIP | READY TO SHIP | PASS | Safe to ship |
| READY TO SHIP | NEEDS FIXES | PASS | Safe to ship with explicit follow-up |
| NEEDS FIXES | * | — | Not ready to ship |
| * | NEEDS FIXES | — | Not ready to ship |
| NOT READY TO SHIP | * | — | Not ready to ship |
| * | NOT READY TO SHIP | — | Not ready to ship |
| * | * | FAIL | Not ready to ship |

---

## Decision Confidence

Every ship judgment includes a confidence level:

| Confidence | Condition |
|---|---|
| **HIGH** | All agent outputs validated, HIGH confidence findings, no gaps, no conflicts |
| **MEDIUM** | Minor gaps (LOW confidence findings, non-blocking issues) |
| **LOW** | Significant gaps, conflicts, or LOW confidence + HIGH severity findings → escalate to user with explicit low-confidence warning |

---

## Integration

Load alongside `mas-aggregation` and `mas-feedback` in every ship orchestrator. This skill handles decisions only.
