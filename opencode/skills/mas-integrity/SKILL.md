---
name: mas-integrity
description: Citation enforcement (≥60% file:line). Session state persistence (.opencode/session-state.md). Dehydrate-Hydrate protocol. 4K token sandbox per worker. Strict output format (no filler). Anti-hallucination checks. Context budget warnings. Cross-session continuity.
---

## 1. Citation Requirement

All agent claims about code MUST include `file:line` evidence.

| Claim | Required |
|---|---|
| "X exists" | `file:line` |
| "Y uses pattern Z" | `file:line` showing pattern |
| "N files affected" | `file:line` per file |
| "Leak/crash" | `file:line` showing path |
| "Architecture pattern" | `file:line` from discovery |

**WRONG**: "Service uses Layer.provide for DI"
**RIGHT**: "Service uses Layer.provide at `src/services/user.ts:45-48`: `const userLive = Layer.provide(...)`"

### Orchestrator Check
1. Count citations. ≥60% of findings must have `file:line`. Below → re-delegate.
2. Spot-check 2-3 random citations for real file existence.
3. No citations → REJECT. "All claims must include file:line evidence."
4. All citations same line, or cite non-existent files → REJECT → escalate user.

---

## 2. Session State

Orchestrator writes `.opencode/session-state.md` after EVERY turn.

```
# MAS Session State | [ts]
## Task
- Original: [verbatim]
- Phase: [discover/architect/implement/review/decide]
- Status: [in_progress/awaiting_user/complete]

## Discovery | #|Finding|Citation|Confidence |
## Architecture Decisions | #|Decision|Rationale|Citation Source |
## Implementation Changes | #|File|Lines|Change|Status |
## Review Findings | #|Issue|Location|Severity|Blocking? |
## Decision Log | #|Decision|User Confirmed? |
## Pending Actions | - [ ] action
## Context Health | sessions:N, context:% | Warnings
```

### State File Usage
- Session start: read FIRST
- After subagent output: update relevant sections
- Before spawning subagent: provide relevant sections as context
- After user confirmation: log decision

---

## 3. Context Budget

| Remaining | Action |
|---|---|
| <30% used | Normal |
| 70-85% used | Warn state file. Prefer narrower scopes. |
| 85-95% used | ALERT user. Suggest new session or split. |
| >95% used | BLOCK spawning. Read state file, ask user. |

**Compressed**: subagent details, conversation history, skill content
**Survives**: session state file, committed file changes, citation chains (if grounded in state file)

---

## 4. Anti-Hallucination (Pre-Aggregation Check)

```
FOR each subagent output:
  ├── Count citations (file:line)
  │   └── <60%? → REJECT → re-delegate
  ├── Spot check 2-3 random citations
  │   └── File exists? → NO → REJECT → escalate
  ├── Cross-reference with session state
  │   └── Contradicts previous? → FLAG conflict
  └── Check severity claims ("HIGH" without impact → downgrade)
```

| Indicator | Action |
|---|---|
| Generic findings, no citations | REJECT |
| All citations same line | REJECT uncited claims |
| Citations reference files not in discovery | REJECT → escalate |
| Formatted but vague | REJECT |
| Contradicts state file w/o explanation | FLAG conflict → escalate |

---

## 5. Cross-Session Continuity

1. Read `.opencode/session-state.md` first
2. Present state to user
3. Ask: continue or fresh start?
4. If continue: resume from `Current phase`
5. If fresh: archive old state, create new

**Locations**: `~/.config/opencode/session-state.md` (global) | `.opencode/session-state.md` (project priority)

---

## 6. Dehydrate-Hydrate Protocol

### Dehydration (before spawning worker)

MUST strip: all comments, non-target function bodies (→ signature only), code outside target scope, conversational prose, task history, previous agent outputs.

KEEP only: function/class/type signatures in scope, immediate imports, interface contracts target code touches, one-sentence `mutation_instructions`.

### Checklist
```
[ ] All comments removed
[ ] Non-target bodies → signature only
[ ] Imports: direct deps only
[ ] No conversation history or prior agent outputs
[ ] Total < 2,000 tokens (half sandbox)
```

### Hydration Rule
Workers receive ONLY dehydrated context. NEVER: full file contents outside scope, other worker outputs, conversation history, orchestrator rationale.

### Transaction Log (Orchestrator State = JSON, NOT code)
```
{"lane_id":"L-001","target_file":"src/svc.ts","target_scope":"Svc.create","mutation_summary":"Added DI","lines_changed":"L45-L48","edge_judge_verdict":"APPROVED","timestamp":"2026-06-02T10:00:00Z"}
```

---

## 7. Token Sandbox (4,000 Hard Cap)

**No worker spawned with >4,000 tokens.**

### Budget
| Component | Max Tokens |
|---|---|
| System prompt + skills | ~800 |
| Dehydrated context (signatures, interfaces) | ~2,000 |
| Instructions + scope | ~300 |
| Domain rules/patterns | ~400 |
| Buffer (tool outputs) | ~500 |
| **TOTAL** | **4,000** |

### Enforcement
- Pre-spawn: estimate token count. >4,000 → decompose or strip further.
- Tool output (read, bash) counts against 4K. ~500 buffer for this.
- Worker receiving >4K → report `TOKEN_OVERFLOW`, request narrower scope.

| Worker Budget | Action |
|---|---|
| <2,500 | Normal |
| 2,500-3,500 | Prefer narrower scopes |
| 3,500-3,900 | WARN, write state, minimal context |
| >3,900 | BLOCK. Decompose or split. |

---

## 8. Strict Output Format

### Per-role Format
| Role | Output | Forbidden |
|---|---|---|
| Implementer | Unified diff / AST patch | Prose, comments, markdown |
| Verifier | Issues table + verdict + confidence | Re-implementation, extrapolation |
| Fixer | Fixes table + corrected impl | New features, scope expansion |
| Edge Judge | JSON verdict + fault_vector | Subjective "maybe" qualifiers |
| AST Aggregator | JSON merge status + patch | Manual code edits |
| Global Judge | JSON integrity + remediation | Implementation suggestions |
| Orchestrator | Delegation + HITL | Code analysis, file writes |

### NO Conversational Filler
Workers NEVER output "I think...", "Let me explain...", "Here's what I did...", or any markdown prose outside structured format. Only text allowed outside format is a `file:line` citation.

### Validation
1. Check required JSON structure or table format
2. Scan for prose sentences not in tables/JSON
3. If filler → REJECT: "Output format violation. Use prescribed format ONLY. No prose."

---

## Integration

Loaded with: `mas-aggregation` `mas-decision` `mas-feedback` `mas-workflow`

### Rules
1. Before trusting output → verify citations (§1)
2. Before starting turn → read state file (§2)
3. Before spawning worker → apply Dehydrate (§6)
4. Before spawning worker → verify ≤4K tokens (§7)
5. After subagent output → validate strict format (§8)
6. When context budget warns → follow §3 + §7 thresholds
