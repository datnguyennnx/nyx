---
name: mas-integrity
description: Citation quality function, context budget enforcement, anti-hallucination checks,
Dehydrate-Hydrate protocol, 4K token sandbox, strict output format rules. Build/lint as absolute truth.
---

## 0. Absolute Truth: Compiler + Linter

The TypeScript compiler and linter are the single source of truth. Domain skill guidance (effect-ts-*, react-vite-*) is advisory. Decision hierarchy:

1. **Does it compile?** (`npx tsc --noEmit`) — if NO → BLOCKING, fix before anything else
2. **Does it pass lint?** (`npx eslint`) — if NO → BLOCKING, fix before domain patterns
3. **Does it pass domain checks?** (anti-patterns, conventions, architecture) — if NO → NON_BLOCKING (unless crash/data-loss/API-break)

A change that compiles and passes lint ships. Domain pattern violations are feedback, not gates. Only the compiler defines what is valid code.

## 1. Citation Quality

```
Q(c) = min(1.0, log₂(c + 1))    c = cited_changes / total_changes
```

| c | Q | Action |
|---|---|---|
| 0.00 | 0.00 | REJECT |
| 0.25 | 0.32 | REJECT |
| 0.50 | 0.58 | MARGINAL — re-delegate |
| 0.60 | 0.68 | ACCEPT |
| 1.00 | 1.00 | FULL_TRUST |

φ = 0.60 derived from Q(c) > 0.5 → c > √2-1 ≈ 0.414, with safety margin.

## 2. Context Budget

| Token Usage | Budget % | Action |
|---|---|---|
| <2,500 | <30% | Normal |
| 2,500–3,500 | 70–85% | Prefer narrower scopes |
| 3,500–3,900 | 85–95% | WARN, write state, minimal context |
| >3,900 | >95% | BLOCK. Decompose or split. |

## 3. Anti-Hallucination

```
FOR each subagent output:
  Count citations → <60%? REJECT → re-delegate
  Spot check 2-3 → file exists? NO → REJECT → escalate
  Cross-reference state → contradicts? FLAG conflict
  Severity "HIGH" without impact → downgrade
```

| Indicator | Action |
|---|---|
| Generic findings, no citations | REJECT |
| All citations same line | REJECT uncited |
| Citations ref files not in discovery | REJECT → escalate |
| Formatted but vague | REJECT |
| Contradicts state file | FLAG → escalate |

## 4. Dehydrate-Hydrate

### Dehydration (before worker spawn)

MUST strip: all comments, non-target bodies (→ signature), out-of-scope code, prose, task history, prior agent outputs.

KEEP: signatures in scope, direct imports, interface contracts, one-line `mutation_instructions`.

Checklist: `[ ] comments removed [ ] bodies→signatures [ ] direct deps only [ ] no history [ ] < 2,000 tokens`

### Hydration

Workers receive ONLY dehydrated context. NEVER: full files outside scope, other worker outputs, conversation history, orchestrator rationale.

### Transaction Log

```json
{"lane_id":"L-001","target_file":"src/svc.ts","target_scope":"Svc.create","mutation_summary":"Added DI","lines_changed":"L45-L48","edge_judge_verdict":"APPROVED","timestamp":"ISO-8601"}
```

## 5. Token Sandbox (4,000 Hard Cap)

| Component | Tokens |
|---|---|
| System prompt + skills | ~800 |
| Dehydrated context | ~2,000 |
| Instructions + scope | ~300 |
| Domain rules | ~400 |
| Buffer (tool outputs) | ~500 |
| **TOTAL** | **4,000** |

Pre-spawn estimate. >4,000 → decompose or strip further.

## 6. Strict Output Format

| Role | Output | Forbidden |
|---|---|---|
| Implementer | Unified diff / AST patch | Prose, comments, markdown |
| Verifier | Issues table + verdict | Re-implementation |
| Fixer | Fixes table + corrected impl | New features, scope expansion |
| Edge Judge | JSON verdict + fault_vector | Subjective qualifiers |
| AST Aggregator | JSON merge status + patch | Manual edits |
| Global Judge | JSON integrity + remediation | Implementation suggestions |
| Orchestrator | Delegation + HITL | Code analysis, file writes |

Workers NEVER output "I think...", "Let me explain...", or prose outside structured format.

Validation: check JSON/table structure, scan for prose, reject filler.
