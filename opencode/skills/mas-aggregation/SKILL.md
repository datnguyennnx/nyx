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

---

## Dynamic Workflow Aggregation (Parallel Tasks)

When the orchestrator uses `mas-workflow` patterns (fan-out to N task coordinators), aggregation has additional concerns beyond the standard 4-step pipeline.

### Parallel Task Results Table

For dynamic workflows, produce this extended table:

```
### Dynamic Workflow Aggregation
| Task | Coordinator | Status | Task Confidence | V1+V2 Agreement | Fixer Changes | Scope OK? | Cross-Task Issues |
|------|-------------|--------|-----------------|-----------------|---------------|-----------|-------------------|
| T1 | [agent] | complete | HIGH | FULL | 2 fixes | YES | None |
| T2 | [agent] | complete | MED | PARTIAL | 5 fixes | YES | Pattern mismatch |
| T3 | [agent] | failed | LOW | NONE | — | NO (expansion) | File overlap with T1 |
```

### Cross-Task Conflict Detection (Step 5)

After standard aggregation, run cross-task checks:

| Check | Method | Conflict Action |
|---|---|---|
| **File overlap** | Compare `scope` and `File` columns across all tasks | ESCALATE — violates task independence |
| **Pattern inconsistency** | Same concern solved differently in different tasks | FLAG for architect review |
| **Missing integration** | Tasks produce disconnected pieces with no glue | GAP — spawn integration task |
| **Dependency violation** | Task B completed before Task A (B depends on A) | INVALID — re-run Task B |

### Task Confidence Rollup

Combine individual task confidences into overall workflow confidence:

| Condition | Workflow Confidence |
|---|---|
| All tasks: HIGH confidence, no cross-task issues | **HIGH** |
| Most tasks HIGH, 1-2 tasks MEDIUM, minor cross-task flags | **MEDIUM** |
| Any task LOW confidence, or cross-task conflicts unresolved | **LOW** |
| Any task FAILED, or file overlap detected | **BLOCKED** |

### Handling Partial Failures

| Scenario | Action |
|---|---|
| 1 task fails out of N | If failure is isolated → report and continue. If failure reveals systemic issue → pause all tasks. |
| Task scope expansion detected | Halt that task. Ask orchestrator whether to merge with overlapping task or split differently. |
| Cross-task pattern inconsistency | Present examples to user. Ask: "Standardize on Pattern A or Pattern B?" |
| Re-verification keeps finding new issues | Task is unstable. Cap at 2 fix cycles. Report NEEDS_REDESIGN to orchestrator. |

### Aggregation Ordering for Dynamic Workflows

1. **Stream aggregation**: As each task coordinator completes, aggregate immediately — don't wait for all N
2. **Early cross-task checks**: After each batch of 5-10 tasks, run file overlap and pattern checks
3. **Checkpoint**: Write batch results to `.opencode/workflow-batch-[N].md`
4. **Final synthesis**: After all tasks complete, run full cross-task conflict detection
5. **Decision input**: Pass rolled-up confidence to `mas-decision`

---

## Integration

Load alongside `mas-decision`, `mas-feedback`, and `mas-workflow` in every ship orchestrator. This skill handles aggregation only.

**For dynamic workflows**: This skill provides the aggregation framework; `mas-workflow` provides the task decomposition and pipeline patterns.
