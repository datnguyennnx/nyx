---
name: mas-integrity
description: Anti-hallucination and state persistence protocol. Prevents context fragmentation, enforces citation-grounded claims, manages session state across turns, and warns on context budget exhaustion. Loaded by all ship orchestrator agents.
---

# MAS Integrity Protocol

This skill prevents the two failure modes that break multi-agent systems: **hallucination cascades** (subagent invents findings → orchestrator trusts them) and **context fragmentation** (session state lost between turns → agents work blind).

---

## 1. Citation Requirement

### Rule: No Evidence = No Trust

Every subagent claim about code MUST include a verifiable citation. The orchestrator must never trust an uncited claim.

| Claim Type | Required Citation |
|---|---|
| "X exists in the codebase" | `file:line` |
| "Y uses pattern Z" | `file:line` showing the pattern |
| "N files are affected" | List of `file:line` for each |
| "This will cause a memory leak" | `file:line` showing the leak path |
| "Architecture uses pattern X" | `file:line` evidence from discovery |

### Output Examples

**WRONG** (will hallucinate under context compression):
```
The service uses Layer.provide for dependency injection.
```

**RIGHT** (verifiable, survives context loss):
```
The service uses Layer.provide at `src/services/user.ts:45-48`:
  const userLive = Layer.provide(UserService.Live, DatabaseLayer)
```

### Orchestrator Citation Check

Before trusting any subagent output, the orchestrator MUST:

1. Count citations in the output
2. Spot-check 2-3 random citations to confirm they reference real patterns
3. If NO citations → REJECT output, re-delegate with: "All claims must include file:line evidence."
4. If citations seem fabricated (e.g., all point to same line, or lines don't exist in known files) → REJECT, escalate to user

**Sufficiency threshold**: At least 60% of findings must have file:line citations. If below → re-delegate.

---

## 2. Session State Protocol

### What Gets Lost Between Sessions

The orchestrator's context window is the only state store. When context is compressed or a new session starts:
- Previous subagent outputs evaporate
- File paths, line numbers, patterns disappear
- The orchestrator can't verify claims against past work

### State File: `.opencode/session-state.md`

The orchestrator writes a state file after EVERY turn. This file is the durable truth — it survives context compression.

**State file format:**

```markdown
# MAS Session State | [timestamp]

## Task
- Original request: [user's request, verbatim]
- Current phase: [discover / architect / implement / review / decide]
- Status: [in_progress / awaiting_user / complete]

## Discovery Findings (verifiable)
| # | Finding | Citation | Confidence |
|---|---------|----------|------------|
| 1 | [what was found] | file:line | HIGH/MEDIUM/LOW |

## Architecture Decisions
| # | Decision | Rationale | Citation Source |
|---|----------|-----------|-----------------|
| 1 | [what was decided] | [why] | [from discovery finding #N] |

## Implementation Changes
| # | File | Lines | What Changed | Status |
|---|------|-------|-------------|--------|
| 1 | [path] | L##-L## | [change] | applied / pending |

## Review Findings
| # | Issue | Location | Severity | Blocking? |
|---|-------|----------|----------|-----------|
| 1 | [issue] | file:line | HIGH/MEDIUM/LOW | YES/NO |

## Decision Log
| # | Decision | User Confirmed? |
|---|----------|-----------------|
| 1 | [what was decided] | YES (turn #) / PENDING |

## Pending Actions
- [ ] [action awaiting user or next subagent]

## Context Health
- Sessions in pipeline: [count]
- Approximate context used: [estimate from conversation length]
- Warnings: [none / approaching limit / compressed — citations may be stale]
```

### State File Usage

- **On session start**: Orchestrator reads state file FIRST, before doing anything else
- **After every subagent output**: Orchestrator updates relevant sections
- **After user confirmation**: Orchestrator logs decision
- **Before spawning a new subagent**: Orchestrator provides relevant state sections as task context

---

## 3. Context Budget Management

### Warning Thresholds

| Condition | Action |
|---|---|
| <70% context remaining | Continue normally |
| 70-85% context used | Add warning to state file. Prefer narrower subagent scopes. |
| 85-95% context used | ALERT user: "Context nearing limit. Key findings saved to session-state.md. Consider starting a fresh session or splitting the task." |
| >95% context used | BLOCK further subagent spawning. Read state file, present summary to user, ask: "Context nearly exhausted. Continue in a new session?" |

### What Gets Compressed

When context compresses, these are the casualties:
1. Subagent output details (findings tables, line numbers)
2. Conversation history (earlier turns)
3. Skill content (less-used skills dropped)

### What Survives Compression

1. **Session state file** (explicitly written to disk)
2. **File changes** (committed to working tree)
3. **Citation chains** (if grounded in state file, not context memory)

---

## 4. Anti-Hallucination Verification

### Pre-Aggregation Check (run before synthesizing any subagent output)

```
FOR each subagent output:
  ├── Count citations (file:line references)
  │   └── < threshold? → REJECT → re-delegate
  ├── Spot check 2-3 random citations
  │   └── Do cited files exist? → NO → REJECT → escalate to user
  ├── Cross-reference with session state
  │   └── Contradicts previous findings? → FLAG conflict
  └── Check severity claims
      └── "HIGH severity" but no concrete impact described? → DOWNGRADE confidence
```

### Hallucination Indicators (red flags)

| Indicator | Meaning | Action |
|---|---|---|
| Generic findings without citations | LLM generated patterns, not observations | REJECT |
| Citations all point to the same line | LLM anchored to one real line, extrapolated | REJECT uncited claims |
| Citations reference files NOT in discovery report | LLM invented files | REJECT → escalate |
| Output format matches but content is vague | LLM formatted correctly but didn't actually analyze | REJECT |
| Findings contradict state file without explanation | LLM forgot earlier session outputs | FLAG conflict → escalate |

---

## 5. Cross-Session Continuity

### When the User Returns (new session)

1. **Read state file first**: Open `.opencode/session-state.md`
2. **Present state to user**: "Last session was [task], at [phase]. Discovery found [key findings]. You were about to [pending action]."
3. **Ask**: "Continue from here or start fresh?"
4. **If continue**: Resume from `Current phase` in state file. Provide state file sections as context to the next subagent.
5. **If start fresh**: Archive old state file, create new one.

### State File Location

- Global: `~/.config/opencode/session-state.md`
- Per-project: `.opencode/session-state.md` (project takes priority)

---

## Integration

Load `mas-integrity` alongside `mas-aggregation`, `mas-decision`, and `mas-feedback` in every ship orchestrator.

**Rule**: Before trusting any subagent output, verify citations. Before starting any new turn, read state file. Before spawning when context is tight, warn.
