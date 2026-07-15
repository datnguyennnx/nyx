---
name: gsearch
description: "Search Google + read/screenshot/scrape web pages. Returns JSON. Requires browser-harness-js on PATH and a Chromium browser."
setup: bash <skill-dir>/scripts/setup
compatibility: "browser-harness-js on PATH + Chromium browser (Chrome, Edge, Brave, Dia, Arc, etc.)"
exit_codes:
  0: success
  1: usage error (bad args)
  2: browser/dependency error (JSON on stderr)
---

## Architecture

**Connect-first, launch-on-demand.** Every operation (`search`, `follow`, `screenshot`, `scrape`) auto-detects an existing browser with CDP enabled before ever launching a new one. No mandatory `gsearch launch` before use.

Detection priority:
1. Already-owned browser (PID tracked via token)
2. User's real browser with CDP enabled (DevToolsActivePort or HTTP /json/version on ports 9222-9225)
3. Nothing running → auto-launches with persistent profile and anti-onboarding flags

Browsers detected: Chrome, Chromium, Edge, Brave, **Dia**, **Arc**, Vivaldi, Opera, Comet, Canary.

## Security

Agents use a persistent but **isolated** profile at `/tmp/gsearch-profile` (not your real browser profile). Anti-onboarding flags (`--no-first-run --disable-fre`) suppress welcome screens.

To connect to your real browser (same cookies/sessions), enable CDP:
- **Dia/Arc**: open `chrome://inspect/#remote-debugging` → toggle ON
- **Chrome/Edge/Brave**: same toggle
- **Terminal**: `<browser> --remote-debugging-port=9222`

Then agents will auto-connect to that same instance (same PID, same profile).

## Commands

### `gsearch launch`

Guarantee a browser is available. Connects to existing browser if running, otherwise launches new instance with persistent profile.

**Returns:** `{"success":true,"pid":...,"profile":"...","port":9222}` or `{"success":true,...,"reused":true}`

```bash
gsearch launch
```

### `gsearch <query> [--count N] [--pretty]`

Search Google. Auto-launches browser if needed. Returns JSON array of `{title, url, snippet}`.

| Flag | Default | Description |
|------|---------|-------------|
| `--count N` | 10 | Max results |
| `--pretty` | off | Human-readable text |

```bash
gsearch "typescript 5.8"
gsearch --count 3 "effect-ts" --pretty
```

### `gsearch follow <url> [--selector S] [--json-url] [--raw] [--settle MS] [--wait M]`

Open a URL and extract readable text or parse JSON.

| Flag | Default | Description |
|------|---------|-------------|
| `--selector S` | `article, main, [role=main]` | CSS selector for text |
| `--json-url` | off | URL returns JSON; poll 15s until parseable |
| `--raw` | off | Output raw text (no JSON wrapper) |
| `--settle MS` | 0 | Extra wait for SPA/lazy content |
| `--wait M` | `networkIdle` | `networkIdle`, `almostIdle`, `load` |

**Returns:** `{"success":bool, "url":"...", "data":"..."}` or with `--raw`: text/JSON directly.

### `gsearch screenshot <url> [--output FILE] [--settle MS] [--wait M]`

Take a full-page PNG screenshot.

| Flag | Default | Description |
|------|---------|-------------|
| `--output FILE` | `screenshot-<timestamp>.png` | Output path |
| `--settle MS` | 0 | Extra wait |
| `--wait M` | `networkIdle` | `networkIdle`, `almostIdle`, `load` |

**Returns:** `{"success":true, "path":"...", "url":"..."}`

### `gsearch scrape <url> [--selector S] [--attr A] [--list] [--raw] [--settle MS]`

Extract structured data from a page via CSS selector.

| Flag | Default | Description |
|------|---------|-------------|
| `--selector S` | `article, main, [role=main]` | CSS selector |
| `--attr A` | (textContent) | Extract attribute instead of text |
| `--list` | off | Return JSON array of all matches |
| `--raw` | off | Output data directly (no JSON wrapper) |
| `--settle MS` | 0 | Extra wait |

**Returns:** `{"success":true, "url":"...", "data":<text|array|attr>}` or with `--raw`: data directly.

## Agent workflow

1. `gsearch "query"` → auto-connects to browser, gets result links
2. `gsearch follow <url>` → reads page text
3. `gsearch scrape <url> --selector "..." --attr "href" --list` → structured data
4. `gsearch screenshot <url>` → visual capture
5. `browser-harness-js '...'` → raw CDP for click/type/wait/interact

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GSEARCH_CDP_PORT` | 9222 | CDP debug port |
| `GSEARCH_PROFILE_DIR` | `/tmp/gsearch-profile` | Browser profile directory |
| `GSEARCH_TOKEN_DIR` | `/tmp/gsearch-tokens` | PID token storage |
| `CHROME_PATH` | (auto-detect) | Override browser binary path |
