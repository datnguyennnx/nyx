---
name: cdp
description: "CDP browser automation via browser-harness-js CLI. 56 domains, 652 typed methods. Persistent session across calls."
compatibility: "Chromium with --remote-debugging-port. Bun required (auto-installed on first run)."
---

## Security

**CRITICAL:** Never connect CDP to Chrome running with your real profile.
CDP has full access to cookies, passwords, history, and can execute JS in any tab context.

Safe workflow:
```bash
gsearch launch    # starts Chrome with isolated /tmp/profile (no cookies, no passwords)
browser-harness-js 'await session.connect()'  # connects to that isolated instance
```

If you see a warning about `real profile` — close that Chrome and use `gsearch launch` instead.
The agent's skills/config should also not be shared — they grant full CDP browser access.

## Usage

```bash
browser-harness-js '<js>'             # single expression (auto-return)
browser-harness-js <<'EOF' ... EOF    # multi-line with explicit return
browser-harness-js --status           # health JSON
browser-harness-js --start            # start REPL server
browser-harness-js --stop             # shutdown server
```

## Globals (pre-loaded)

| Global | Description |
|--------|-------------|
| `session` | Persistent `Session` instance. All CDP domains mounted. |
| `session.connect()` | Auto-detect browser or `{wsUrl}` / `{profileDir}` |
| `session.use(targetId)` | Attach to a tab. Subsequent calls route to it. |
| `session.waitFor(method, pred?, timeoutMs)` | Wait for CDP event |
| `listPageTargets()` | `[{targetId,title,url,type}]` — filters chrome:// |
| `detectBrowsers()` | Scan running Chromium browsers |
| `CDP.Page`, `CDP.Runtime`, etc. | Generated type namespaces (for reference) |

## Method convention

```js
// No params
await session.Page.enable()

// Object params
await session.Page.navigate({ url: "https://example.com" })

// Return = typed result (no CDP envelope)
const { root } = await session.DOM.getDocument()
const { nodeId } = await session.DOM.querySelector({ nodeId: root.nodeId, selector: "h1" })
```

## Common patterns

| Operation | Code |
|-----------|------|
| Navigate + wait idle | `await session.Page.navigate({url:"..."}); await session.waitFor("Page.lifecycleEvent", p => p.name==="networkIdle")` |
| Click element | `await session.Runtime.evaluate({expression:"document.querySelector('...').click()"})` |
| Type text | `await session.Runtime.evaluate({expression:"document.querySelector('...').value='...'"})` |
| Read text | `(await session.Runtime.evaluate({expression:"document.querySelector('...').textContent",returnByValue:true})).result.value` |
| Get attribute | `(await session.Runtime.evaluate({expression:"document.querySelector('...').getAttribute('...')",returnByValue:true})).result.value` |
| Screenshot | `(await session.Page.captureScreenshot({format:"png"})).data` → base64 PNG |
| Scroll to | `await session.Runtime.evaluate({expression:"document.querySelector('...').scrollIntoView()"})` |
| Wait for element | poll with `document.querySelector('...')` in a loop |
| Tab list | `await listPageTargets()` |
| Create tab | `await session.Target.createTarget({url:"about:blank"})` |
| Switch tab | `await session.use(targetId)` |
| Close tab | `await session.Target.closeTarget({targetId})` |
| Block request | `await session.Network.setBlockedURLs({urls:["*"]})` |
| Mock response | `await session.Network.enable();` then handle `Network.requestIntercepted` |

## Connect

```js
await session.connect()                                  // auto-detect
await session.connect({ wsUrl: "ws://127.0.0.1:9222/..." })  // explicit
await session.connect({ profileDir: "~/Library/.../Chrome" }) // by profile
```

## State persistence

- `session`, active `sessionId`, event subscribers, and `globalThis.*` persist across `browser-harness-js` calls.
- Each call runs in its own async wrapper; use `globalThis` to carry data.
- REPL server (`repl.ts`) holds everything; kill with `--stop` or restart with `--restart`.

## Interaction skills (task-organized)

Agent: given a task, read the relevant file for exact CDP recipes.

| File | Use when |
|------|----------|
| `01-page-lifecycle.md` | Connect to browser, navigate, manage tabs, handle iframes, wait for page ready |
| `02-page-content.md` | Extract text, take screenshots, generate PDF, scroll, traverse shadow DOM, set viewport |
| `03-user-interaction.md` | Click elements, type text, select dropdowns, drag-and-drop, handle dialogs, upload files |
| `04-network-data.md` | Read/write cookies, intercept network requests, handle downloads |

**Note:** `gsearch` CLI handles the 3 most common agent tasks: search (`gsearch "q"`), read page (`gsearch follow <url>`), screenshot (`gsearch screenshot <url>`), and scrape (`gsearch scrape <url> --selector "..."`). For anything beyond those 4, use `browser-harness-js` directly with recipes from `interaction-skills/`.
