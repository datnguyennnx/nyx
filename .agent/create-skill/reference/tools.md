---
name: create-skill-tools
description: "Tool mapping, permission patterns, context efficiency, and sub-agent spawning for SKILL.md files."
---

# Adapting Skills to agent Tools

Skills run inside agent's agent environment. Every instruction must be compatible with agent's tool set and written at the right level of specificity.

## Tool Mapping

| Skill action | agent tool | Example |
|---|---|---|
| Read a file | `read` | `read("src/components/Button.tsx")` |
| Search file contents | `grep` | `grep("pattern", "src/**/*.ts")` |
| Find files by pattern | `glob` | `glob("src/**/*.css")` |
| Run a command | `bash` | `bash: tsc --noEmit` |
| Write/change a file | `edit` | `edit("src/file.ts", ...)` |
| Fetch web content | `webfetch` | `webfetch("https://api.example.com/docs")` |
| Spawn a sub-agent | `task` | `task(discovery, ...)` |
| Load a skill | `skill` | `skill({ name: "mas" })` |

## Exact Commands Rule

Commands that MUST be written exactly as they should be run:

| Category | Good (exact) | Bad (vague) |
|---|---|---|
| Build/check | `tsc --noEmit` | "run the type checker" |
| File paths | `src/components/Button.tsx` | "the button component file" |
| Tool invocation | `skill({ name: "mas" })` | "load the orchestration skill" |
| Bash commands | `pnpm test 2>&1 \| tail -20` | "run tests and check output" |
| API calls | `curl -s -X POST "$BASE/health"` | "make a health check request" |

If the command can be copied and pasted into a terminal, it's specific enough. If the reader needs to fill in values, use placeholders like `<file-id>` or `[target]` with clear instructions.

## Sub-Agent Spawning

When a skill needs to spawn a sub-agent via `task()`:

1. **Include SKILLS** in the prompt — the sub-agent needs domain context
2. **Set tool permissions** — `task: deny` for read-only agents
3. **Provide output contract** — specify the format the agent must return
4. **Isolate context** — the sub-agent has no access to the parent conversation

### Prompt template for sub-agent spawn

```
TASK: <what to do>
TARGET_FILES: <specific paths>
REQUIREMENTS: <what success looks like>
SKILLS: <domain skills list>
OUTPUT CONTRACT: <exact format specification>
You have no access to prior conversation, only what is in this prompt.
```

## Context Efficiency

The skill loads into the agent's system context. Every line consumes token budget.

| Technique | Token savings | Example |
|---|---|---|
| Tables over enumerated lists | 30-50% fewer tokens | 3-row table vs 3 sentences |
| Code blocks only for commands | Avoids prose descriptions of commands | `tsc --noEmit` instead of "run the TypeScript compiler with the noEmit flag" |
| Once-per-concept naming | Reference by name after first definition | "The GATE" instead of re-explaining each time |
| Front-loaded importance | Most important content first | Context loss impacts the end first, so put core rule and traps at the top |

## Permission Patterns

Skills should tell the agent which tools are safe to use for which operations:

| Tool | Typical permission | When to restrict |
|---|---|---|
| `read` | Allow | Always safe — read-only |
| `edit` | Allow with caution | Restrict for discovery/review-only tasks |
| `bash` | Allow for build/check commands | Restrict for destructive operations (rm, git push --force) |
| `task` | Allow for complex subtasks | Restrict for simple lookups (use grep/glob directly) |
| `skill` | Allow | Always safe — loads more domain context |

When a skill includes potentially destructive operations (delete, force-push, sudo), add an explicit guard: "Never do X without user confirmation."

## Tool Mapping for 2026 Skills

| Action | Tool | Example | Permission |
|--------|------|---------|------------|
| Read a file | `read` | `read("src/file.ts")` | Allow |
| Search contents | `grep` | `grep("pattern", "src/**/*.ts")` | Allow |
| Find files | `glob` | `glob("src/**/*.css")` | Allow |
| Run command | `bash` | `bash: tsc --noEmit` | Allow (read-only) |
| Edit a file | `edit` | `edit("src/file.ts", ...)` | Restrict |
| Spawn agent | `task` | `task(discovery, ...)` | Restrict |
| Load skill | `skill` | `skill({ name: "mas" })` | Allow |
| Web search | `gsearch` | `gsearch batch search "query"` | Allow |
| Web follow | `gsearch follow` | `gsearch follow <url>` | Allow |

## Permission Patterns for Skills

| Skill type | read | edit | bash | task | skill | gsearch |
|------------|------|------|------|------|-------|---------|
| Discovery/Research | PASS | FAIL | FAIL | FAIL | PASS | PASS |
| Code implementer | PASS | PASS | PASS | FAIL | PASS | FAIL |
| Verifier/Reviewer | PASS | FAIL | PASS (git diff) | FAIL | PASS | FAIL |
| Orchestrator | FAIL | FAIL | FAIL | PASS | PASS | FAIL |

## Context Efficiency (2026 updates)

| Technique | Token savings | Example |
|-----------|--------------|---------|
| Tables over lists | 30-50% | 3-row table vs 3 sentences |
| Code blocks for commands | 40-60% | `tsc --noEmit` vs "run the TS compiler with noEmit" |
| Once-per-concept naming | 20-30% | "The GATE" after first definition |
| Front-loaded importance | Variable | Core rule and traps at top survive context loss |
| Progressive disclosure | 80%+ | References loaded on demand vs all at once |
| Skill retirement | 100% for retired skills | Archived skills consume zero context |
