---
name: mas-decision
description: Ship judgment framework and confidence formula. Conceptual definitions for interpreting the TS Engine's global-judge output. Loaded by the ship-mas mode.
---

## Decision Matrix

| Global Judge Verdict | Condition | Ship Judgment |
|---|---|---|
| APPROVED | All requirements covered, no regression vectors | Safe to ship |
| APPROVED_WITH_NOTES | Minor gaps, no blocking issues | Safe to ship with follow-up |
| NEEDS_REMEDIATION | Missing requirements, corrupted mutations, or regression vectors | Not ready — present blocking issues |

## Confidence Formula

`C = (C_cit + C_ver + C_gj) / 3`. C_cit = cited/total changes. C_ver = 1.0 PASS, 0.5 mixed, 0.0 FAIL. C_gj = integrity_score/100. Unavailable component → redistribute weight equally.

| C Range | Level | Action |
|---|---|---|
| ≥ 0.80 | HIGH | Safe to ship |
| 0.50 – 0.80 | MEDIUM | Ship with caveats |
| < 0.50 | LOW | Escalate — do not auto-ship |
