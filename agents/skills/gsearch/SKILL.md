---
name: gsearch
description: "Search Google + read/screenshot/scrape web pages. Returns JSON. Requires browser-harness-js on PATH and Chromium with --remote-debugging-port."
setup: bash <skill-dir>/scripts/setup
compatibility: "browser-harness-js on PATH + Chromium --remote-debugging-port=9222"
exit_codes:
  0: success
  1: usage error (bad args)
  2: browser/dependency error (JSON on stderr)
---

## Security

**Chrome must use an isolated profile** — never your real Chrome profile.

Safe ways to start Chrome:
```bash
gsearch launch                                # auto-starts Chrome with temp profile
gsearch launch                                # or already running? → gsearch "query"
```

`gsearch launch` creates `/tmp/gsearch-profile-<ts>/` (no cookies, no history, no passwords).  
Without `launch`, gsearch warns if it detects a real profile via `User-Data-Dir`.

Do NOT share or expose the agent's config/skills — they have full CDP access to Chrome.

## Commands

### `gsearch launch`

Start Chrome with an isolated temp profile for safe agent automation.

**Returns:** `{"success":true, "pid":..., "profile":"...", "port":9222}`

```bash
gsearch launch
```

### `gsearch <query>`

### `gsearch <query> [--count N] [--pretty]`

Search Google. Returns JSON array of `{title, url, snippet}`.

| Flag | Default | Description |
|------|---------|-------------|
| `--count N` | 10 | Max results |
| `--pretty` | off | Human-readable text |

**Returns:** `[{"title":"...","url":"...","snippet":"..."}]`

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

```bash
gsearch follow https://example.com
gsearch follow --json-url https://api.example.com/data.json --raw
```

### `gsearch screenshot <url> [--output FILE] [--settle MS] [--wait M]`

Take a full-page PNG screenshot.

| Flag | Default | Description |
|------|---------|-------------|
| `--output FILE` | `screenshot-<timestamp>.png` | Output path |
| `--settle MS` | 0 | Extra wait |
| `--wait M` | `networkIdle` | `networkIdle`, `almostIdle`, `load` |

**Returns:** `{"success":true, "path":"...", "url":"..."}`

```bash
gsearch screenshot https://example.com --output /tmp/page.png
```

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

```bash
gsearch scrape https://example.com --selector h1 --raw
gsearch scrape https://github.com --selector "a" --attr href --list --raw
```

## Agent workflow

1. `gsearch "query"` → get result links
2. `gsearch follow <url>` → read page text
3. `gsearch scrape <url> --selector "..." --attr "href" --list` → extract structured data
4. `gsearch screenshot <url>` → capture page visually
5. `browser-harness-js '...'` → raw CDP for click/type/wait/interact
