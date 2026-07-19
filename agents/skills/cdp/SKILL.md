---
name: cdp
description: "CDP browser automation via browser-harness-js CLI. 56 domains, 652 typed methods. Persistent session across calls."
compatibility: "Chromium with --remote-debugging-port. Bun required (auto-installed on first run)."
---

## Security

**CRITICAL:** Never connect CDP to Chrome running with your real profile.
CDP has full access to cookies, passwords, history, and can execute JS in any tab context.

Always use `gsearch launch` to start Chrome with an isolated temp profile at `/tmp/gsearch-profile`.

## The Core Rule

All browser automation goes through `browser-automation.ts`. It wraps every tab operation with timeouts, error isolation, and content quality gates. Never call `browser-harness-js` directly — it has none of these safeguards.

## When This Applies

| Use CDP when | Use gsearch instead |
|---|---|
| Single page follow, extract, screenshot | Multi-query web search with batch research |
| Raw CDP automation code | Batch follow with dedup and ranking |
| Tab lifecycle control (create, navigate, close) | arXiv auto-conversion, PDF extraction |
| Debugging browser interaction | Full research pipeline (search → dedup → extract) |

## Core Commands

```
browser-automation.ts follow <url> [--selector S] [--timeout MS] [--port N] [--raw]
browser-automation.ts batch-follow <url1> ... [--selector S] [--timeout MS] [--port N]
browser-automation.ts search <query> [--count N] [--port N]
browser-automation.ts batch-search <q1> ... [--count N] [--port N]
browser-automation.ts batch-harvest <q1> ... [--count N] [--max M] [--timeout MS] [--port N]
```

## The Traps You Will Hit

### Trap 1: The Direct-Call Trap
You think calling `browser-harness-js` directly is faster. But it has no timeout wrapping, no error isolation, no quality gate. Every call must go through `browser-automation.ts`.
— `reference/multi-tab.md`, `SKILL.md` Core Rule

### Trap 2: The One-Shot Wait Trap
You think `session.waitFor()` registers a persistent listener. But it fires once on the currently active target. Switching tabs orphans the listener. Use polling (`document.readyState`) for multi-tab operations.
— `reference/multi-tab.md`

### Trap 3: The Leaking-Tab Trap
You think closing the script closes all tabs. They persist across calls. Every `createTarget()` needs a `closeTarget()` in try/finally.
— `reference/errors.md`

### Trap 4: The Content-Confidence Trap
You think extracted text is always usable. Many pages return error messages, paywalls, or empty shells. Always run the quality gate and check for `_error: "low_quality_content"`.
— `reference/content-quality.md`

## Playbook

1. **Launch browser** — `gsearch launch` (isolated Chrome on port 9222)
2. **Connect** — `browser-automation.ts` handles connection automatically
3. **Pick command** — follow (single URL), search (single query), batch-follow (multi URL), batch-search (multi query), batch-harvest (research pipeline)
4. **Extract** — content is quality-gated automatically
5. **Close** — tabs close in try/finally; REPL state persists across calls
6. **Verify** — check output for `_error` fields; retry with longer timeout if empty

## Decision Tree

| Task | Command |
|---|---|
| Single URL content | `browser-automation.ts follow <url>` |
| Multiple URLs | `browser-automation.ts batch-follow <url1> <url2> ...` |
| Single Google search | `browser-automation.ts search <query> --count N` |
| Multiple Google searches | `browser-automation.ts batch-search <q1> <q2> ... --count N` |
| Full research pipeline | `browser-automation.ts batch-harvest <q1> ... --count N --max M` |
| PDF URL | Use follow or batch-follow; PDFs auto-detected |

## Reference Documents

| File | Content |
|---|---|
| `reference/multi-tab.md` | Multi-tab parallelism, polling vs waitFor, error isolation |
| `reference/errors.md` | CDP error codes, JS errors, REPL health, failure patterns |
| `reference/content-quality.md` | Content quality gate — detection patterns |
| `reference/workspace-management.md` | /tmp/nyx-search/ workspace, cleanup rules |
| `interaction-skills/01-page-lifecycle.md` | Tab creation, navigation, wait strategies, iframes, dialogs |
| `interaction-skills/02-page-content.md` | Text extraction, screenshots, PDF, scrolling, shadow DOM |
| `interaction-skills/03-user-interaction.md` | Click, type, select, drag-and-drop, file upload |
| `interaction-skills/04-network-data.md` | Cookies, network interception, downloads, credentials |

## State Persistence

REPL state persists across `browser-automation.ts` calls. The `session` object and `globalThis` variables accumulate. Use `browser-harness-js --restart` to drop all state.

## Testing

74 TypeScript tests at `tests/`: `bun test agents/skills/cdp/tests/`
Covers template function purity, session.ts hardening, repl.ts serialization.
