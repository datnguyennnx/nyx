# Workspace Management — `/tmp/nyx-search/`

## Purpose

`/tmp/nyx-search/` is the canonical workspace directory for all gsearch and CDP browser automation operations. Every generated JS template, extracted page content, AST discovery tree, screenshot, and session artifact goes here. This directory persists across agent invocations so agents can:

- Resume interrupted discovery sessions
- Reference previously extracted content without re-fetching
- Debug failed batch commands by inspecting generated JS
- Track disk usage and clean up stale files

## Directory Structure

```
/tmp/nyx-search/
├── sessions/           # Per-discovery-session directories
│   └── ses_<sessionId>/
│       ├── pages/      # Extracted page content per URL
│       │   └── <domain>-<hash>.json   # {url, title, content, extractedAt, ast?}
│       ├── ast.json    # Consolidated AST knowledge tree for this session
│       └── meta.json   # {queries, sources, timestamps, stats}
├── debug/              # Debug JS files preserved from batch commands
│   ├── batch-follow-<timestamp>.js
│   ├── batch-harvest-<timestamp>.js
│   └── batch-search-<timestamp>.js
├── screenshots/        # Screenshots from gsearch screenshot command
│   └── screenshot-<timestamp>.png
├── cache/              # Cached page content (avoid re-fetching same URL)
│   └── cache-<md5(url)>.json
└── tmp/                # Ephemeral temp files (auto-cleaned)
    └── gsearch-batch-*.js   # Temp JS files (delete after REPL executes)
```

## Lifecycle Rules

| Directory     | Created by                    | Auto-clean              | When                                |
|---------------|-------------------------------|-------------------------|-------------------------------------|
| `sessions/`   | gsearch batch harvest/follow  | After agent completes   | Agent clears on session end         |
| `debug/`      | gsearch batch commands on err | After 24h               | OS `/tmp` cleanup or agent          |
| `screenshots/`| gsearch screenshot            | Manual                  | User decides                        |
| `cache/`      | gsearch follow (with --cache) | After 1h TTL            | Agent or TTL expiry                 |
| `tmp/`        | gsearch batch commands        | Immediately after REPL  | gsearch script deletes              |

## Usage by AI Agents

### Reading Artifacts

```bash
# List all debug files from failed batch commands
ls /tmp/nyx-search/debug/

# View a specific debug template to diagnose syntax errors
cat /tmp/nyx-search/debug/batch-follow-*.js

# Check AST tree from a session
cat /tmp/nyx-search/sessions/ses_*/ast.json

# Find cached content for a URL
ls /tmp/nyx-search/cache/ | grep <md5hash>
```

### Cleaning Up

```bash
# Remove all debug files (safe — they're copies of temp files)
rm -f /tmp/nyx-search/debug/*.js

# Remove a specific session
rm -rf /tmp/nyx-search/sessions/ses_<sessionId>

# Clear entire cache (safe — cache is regenerated on re-fetch)
rm -f /tmp/nyx-search/cache/*.json

# Remove all screenshots
rm -f /tmp/nyx-search/screenshots/*.png

# Full cleanup (keep directory structure)
rm -f /tmp/nyx-search/debug/*.js
rm -f /tmp/nyx-search/cache/*.json
rm -f /tmp/nyx-search/screenshots/*.png
rm -f /tmp/nyx-search/tmp/*.js

# Nuke everything (recreate with mkdir -p)
rm -rf /tmp/nyx-search
mkdir -p /tmp/nyx-search/{sessions,debug,screenshots,cache,tmp}
```

## Optimization

| Situation                  | Action                                          |
|----------------------------|-------------------------------------------------|
| Disk usage > 500MB         | Run full cleanup (keep structure)               |
| Too many session dirs      | Remove sessions older than 1 hour               |
| Debug files accumulating   | Clear `debug/` after successful debugging session|
| Cache stale                | Clear `cache/` — next fetch regenerates         |
| Screenshots piling up      | Move to permanent storage or delete             |

## Grepping Through Artifacts

```bash
# Find which URL caused an error
grep -l "_error" /tmp/nyx-search/sessions/*/pages/*.json

# Search all extracted content for a keyword
grep -r "keyword" /tmp/nyx-search/sessions/*/pages/*.json 2>/dev/null

# Find all sessions that queried a specific topic
grep -l '"query":.*finance' /tmp/nyx-search/sessions/*/meta.json

# Find AST nodes mentioning a specific entity
grep -r '"content":.*Bitcoin' /tmp/nyx-search/sessions/*/ast.json
```

## Safety Rules (NEVER Violate)

1. **Never delete the directory itself** — `rm -rf /tmp/nyx-search` destroys ALL sessions, caches, and debug data. Recreate it immediately with `mkdir -p /tmp/nyx-search/{sessions,debug,screenshots,cache,tmp}` if you do.
2. **Don't delete active session data** — a session dir with `meta.json` that is < 5 minutes old is likely in use.
3. **Cache is regeneratable** — cached content can always be re-fetched. Safe to delete.
4. **Debug files are copies** — the original temp file was already deleted by gsearch. Debug files are safe to delete at any time.
5. **Screenshots are user data** — don't delete screenshots unless explicitly asked.

## Auto-cleanup Script

For quick cleanup by the agent:

```bash
# Quick cleanup (safe — preserves directory structure)
find /tmp/nyx-search/debug -name '*.js' -mtime +1 -delete 2>/dev/null
find /tmp/nyx-search/cache -name '*.json' -mtime +1 -delete 2>/dev/null
find /tmp/nyx-search/sessions -depth -mmin +120 -type d -exec rm -rf {} \; 2>/dev/null
```

## Integration with gsearch

If gsearch is configured to use `/tmp/nyx-search/`:

```bash
# Set environment variable to redirect temp files
export GSEARCH_TMP_DIR=/tmp/nyx-search/tmp
export GSEARCH_DEBUG_DIR=/tmp/nyx-search/debug
export GSEARCH_SCREENSHOT_DIR=/tmp/nyx-search/screenshots

# Run commands as usual — artifacts go to nyx-search
gsearch batch harvest --count 5 --max 3 "query1" "query2"
gsearch screenshot "https://example.com"
```

## Session Metadata Format (`meta.json`)

```json
{
  "sessionId": "ses_abc123",
  "createdAt": "2026-07-19T08:00:00Z",
  "updatedAt": "2026-07-19T08:05:00Z",
  "queries": ["query1", "query2"],
  "sources": [
    {"url": "https://example.com", "status": "read", "contentLength": 12345},
    {"url": "https://example.org", "status": "error", "error": "low_quality_content"}
  ],
  "stats": {
    "urlsTotal": 10,
    "urlsRead": 8,
    "urlsSkipped": 2,
    "astNodes": 45,
    "diskUsage": "234KB"
  }
}
```

## Page Cache Format (`cache-<md5>.json`)

```json
{
  "url": "https://httpbin.org/html",
  "cachedAt": "2026-07-19T08:00:00Z",
  "ttl": 3600,
  "content": "Herman Melville - Moby-Dick\n\nAvailing himself...",
  "contentLength": 1573,
  "ast": null
}
```

## Guardrails

1. Always check `du -sh /tmp/nyx-search/` before cleanup to understand usage
2. Never `grep -r` binary files — only JSON and text
3. If `sessions/` has > 50 directories, suspect a leak and clean old ones
4. Always recreate the directory structure after nuke:
   ```bash
   mkdir -p /tmp/nyx-search/{sessions,debug,screenshots,cache,tmp}
   ```
