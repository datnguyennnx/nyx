---
name: mas-aggregation
description: Aggregate subagent outputs into coherent decisions. Provides format validation, evidence quality assessment, conflict detection, gap detection, and synthesis table generation. Loaded by all ship orchestrator agents.
---

# MAS Aggregation Engine

This skill defines HOW an orchestrator aggregates structured subagent outputs into a coherent single decision. It does NOT classify tasks, delegate work, or define agent roles — those are the ship agent's responsibility.

---

## Aggregation Pipeline (4-step)

### Step 1: Format Validation
Check each subagent output against its prescribed format. Reject any that don't match.

| Subagent | Required Format Sections |
|---|---|
| discovery | Findings table, Boundary Map, Dependency Graph, Runtime Analysis, Assumptions |
| architect | Assessment table, Recommendations table, Handoff table, Dependency Analysis, Verdict |
| implementer | Changes table, Change Details, Boundary Check, Verification Notes |
| review | Correctness table, Issues Found table, Compliance section, Regression Risk, Review Verdict |

**Rule**: If an output is MISSING a required section → RE-DELEGATE with "Your output is missing [section]. Re-run and include it."

### Step 2: Evidence Quality
Rate each finding on Confidence + Severity:

**Confidence**: HIGH (direct file:line evidence) > MEDIUM (pattern-inferred) > LOW (speculative)

**Severity** (if the finding is an issue): HIGH (blocking/breaking/security) > MEDIUM (degrading/unreliable) > LOW (cosmetic/suboptimal)

### Step 3: Conflict Detection
Check for contradictions between agent outputs:
- Discovery: "X exists at file:line" but Architect: "X not found" → CONFLICT
- Architect: "Use primitive A" but Implementer: "Used primitive B" → CONFLICT
- Implementer: "Change at file:line" but Review: "No change found at file:line" → CONFLICT

**Conflict resolution**: Present both findings to user. NEV

ER auto-resolve.

### Step 4: Gap Detection
Identify missing information that blocks the next stage:
- Discovery has no entrypoint → Gap (Architect can't assess Edge of the World)
- Architect has no handoff table → Gap (Implementer can't start)
- Review has no verdict → Gap (Can't make ship decision)
- Any finding marked LOW confidence + HIGH severity → Gap (Need verification)

**Gap resolution**: Report gap to user. Do not proceed until resolved.

---

## Output: Aggregation Summary Table

Always produce this table in orchestrator output:

```
### Aggregation Summary
| Source Agent | Format? | Confidence | Severity | Gaps? | Conflicts? | Action |
|---|---|---|---|---|---|---|
| [name] | YES/NO | HIGH/MED/LOW | —/HIGH/MED/LOW | YES/NO | YES/NO | ACCEPT/RE-DELEGATE/ESCALATE |
```

**Action meanings:**
- ACCEPT → Use this output for synthesis
- RE-DELEGATE → Output has format issues or missing evidence. Re-spawn agent with explicit fix instructions.
- ESCALATE → Conflicts or gaps exist. Present to user for decision.

---

## Integration

Load alongside `mas-decision` and `mas-feedback` in every ship orchestrator. This skill handles aggregation only.
