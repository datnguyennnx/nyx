---
name: gsearch
description: "Search Google + read web pages + extract PDFs. Parallel multi-tab batch operations. arXiv PDFs auto-convert to abstract pages. Use ONLY when you need web research — not for local file operations or system administration."
setup: bash <skill-dir>/scripts/setup
compatibility: "browser-harness-js on PATH + Chromium browser (Chrome, Edge, Brave, Dia, Arc). Bun auto-installed."
exit_codes:
  0: success (JSON on stdout)
  1: usage error (bad args)
  2: browser/dependency error (JSON on stderr)
---

## The Core Rule

**gsearch delegates all browser automation to the CDP skill.** gsearch handles search strategy (queries, dedup, source selection). Browser operations (page load, extraction, tabs) are handled by `scripts/browser-automation.ts` in the CDP skill. See `agents/skills/cdp/SKILL.md` for the browser automation reference.

**Under the hood:** browser-harness-js is a single-threaded REPL. Shell `&` does NOT parallelize — it queues at the server. gsearch batch commands create multiple CDP tabs within one invocation for true parallelism.

**PDFs are handled automatically.** arXiv PDFs convert to abstract page HTML. Others get Chrome viewer extraction. Fallback: `gsearch pdftotext <url>`.

## Required First Pass

```bash
gsearch launch
# → {"success":true,"pid":...,"port":9222}
```

Starts isolated Chromium at `/tmp/gsearch-profile` with `--remote-debugging-port=9222`. Run once. Your real browser is never touched.

## Reference Documents

| File | Content |
|------|---------|
| `reference/commands.md` | All commands with flags, return types, error codes, environment variables |
| `reference/pdf-extraction.md` | 3-tier PDF handling (arXiv rewrite, Chrome viewer, pdftotext), URL detection logic, error reference |
| `reference/troubleshooting.md` | CDP connection failures, empty results, PDF extraction issues, environment setup, exit codes |
| `reference/ast-discovery.md` | Structured knowledge tree for web research — provenance, token efficiency, anti-hallucination |
| `reference/workspace-management.md` | /tmp/nyx-search/ workspace — lifecycle, cleanup, grep patterns, safety rules |

## Architecture

gsearch is a search strategy skill. All browser automation is handled by the CDP skill.
gsearch bash commands call `cdp/scripts/browser-automation.ts` for browser operations.

See `agents/skills/cdp/SKILL.md` for browser automation reference.

## Playbook

1. **Launch first.** `gsearch launch`, one time. All commands auto-connect after.
2. **Use `batch harvest` for any multi-source topic.** One command = parallel search + dedup + parallel read.
3. **Give each query a different angle.** "US Fed" + "ECB policy" + "Japan Nikkei" = 3 dimensions. "S&P 500" + "Dow Jones" + "Nasdaq" = 1 dimension, 3 times.
4. **Use `batch search` when you only need URLs + snippets** — not full pages.
5. **Use `batch follow` when you already have URLs** — reads all in parallel.
6. **Use `gsearch "query"` for a single narrow fact.**
7. **Never shell-background (`&`) gsearch commands.** It queues at the REPL.
8. **Never open `chrome://inspect/`.** It does NOT enable CDP. Use `gsearch launch`.
9. **Check `_error` fields in batch results.** That's how you know what failed and why.
10. **Use `gsearch pdftotext <url>` for PDFs** when Chrome viewer can't extract.
11. **Use gsearch for ALL web access.** When the user says "gsearch" or asks you to research, use gsearch commands for ALL web access — gsearch search, gsearch follow, gsearch batch harvest. Do NOT fall back to webfetch or other general-purpose fetch tools. The user chose gsearch for CDP-powered browser automation (JS rendering, anti-bot bypass, parallel tabs), not raw HTTP fetching.

## The Traps You Will Hit

### Trap 1: The Background-&-Wait Trap

**You think:** "I'll run 3 searches with `&` and `wait` for 3x speed."

**What happens:** The REPL processes them serially. 3 sequential calls at 5s each = 15s.

**Detect:** Results come back one-at-a-time despite `&`.

**Fix:** `gsearch batch search q1 q2 q3` — one invocation, concurrent tabs, ~5s total.

### Trap 2: The Inspect-Page Trap

**You think:** "chrome://inspect toggle enables CDP."

**What happens:** That toggle discovers *remote* targets. It does NOT start a local CDP server. Old code popped up the browser creating an infinite useless loop.

**Detect:** Dia/Chrome keeps popping up. Toggle does nothing.

**Fix:** `gsearch launch` starts `--remote-debugging-port=9222`. Never open inspect page.

### Trap 3: The Narrow-Queries Trap

**You think:** "I'll search 'US stocks', 'S&P 500', 'Dow Jones' for thorough coverage."

**What happens:** All three return the same URLs — same Reuters article 3 times.

**Detect:** Results have duplicate URLs across queries.

**Fix:**
```bash
# Bad: same dimension
gsearch batch harvest "US stocks" "S&P 500" "Dow Jones"

# Good: three independent dimensions
gsearch batch harvest "Fed rate July 2026" "ECB monetary policy" "Japan Nikkei"
```

### Trap 4: The PDF-Is-Empty Trap

**You think:** "PDF URLs will extract text like HTML pages."

**What happens:** Chrome renders PDF as canvas — `document.querySelector()` returns empty.

**Fix:** arXiv PDFs auto-convert (no action needed). Other PDFs get Chrome viewer extraction. If `_error: "pdf_textlayer_empty"`, use:
```bash
gsearch pdftotext "https://example.com/paper.pdf"
```

### Trap 5: The Dead-Tab Trap

**You think:** "A connection error will crash the whole batch."

**What happens:** Each tab is isolated with try/catch. Dead tabs get `_error`, live tabs continue.

**Detect:** `_error: "ERR_CONNECTION_CLOSED"` in results.

**Fix:** Nothing — error isolation is built in. Check `meta.pages_skipped`.

### Trap 6: The Paywall-Teaser Trap

**You think:** "The page loaded and returned text — that is useful."

**What happens:** "Read More »" is < 80 chars of real information. The content quality gate filters these automatically.

**Detect:** `_error: "low_quality_content"`.

**Fix:** Find better sources. If too many pages are filtered, your source selection needs improvement.

### Trap 7: The Fetch-Tool-Fallback Trap

**You think:** "I need to read a paper abstract — I will use webfetch for this."

**What happens:** The user asked you to use gsearch. You used a raw HTTP fetch tool that cannot render JavaScript, bypass anti-bot, or handle dynamic pages. The content may be empty or blocked.

**Detect:** You are using `webfetch` (or a similar HTTP fetch tool) after the user said "gsearch" or after you loaded the gsearch skill.

**Fix:** Use `gsearch follow <url>` for every page you read. That is what gsearch is for — CDP-powered browser automation with JS rendering, anti-bot evasion, and parallel tab support. Never fall back to HTTP fetch tools when the user chose gsearch.

**Rationale:** webfetch sends a raw HTTP request. It cannot execute JavaScript, cannot bypass Cloudflare, and returns whatever the server sends — often an empty shell or a captcha page. gsearch follow launches a real Chrome tab, renders the page, executes JS, and extracts visible text. For arXiv abstracts, SSRN papers, Google Scholar profiles — any real website — gsearch follow is what you need.

## Decision Tree

```
Topic to research?
├─ Yes → One fact or broad topic?
│        ├─ One fact → gsearch "query" → pick URL → gsearch follow <url>
│        └─ Broad → gsearch batch harvest --count 5 --max 3 "q1" "q2" "q3"
├─ No → Have URLs? → gsearch batch follow url1 url2 url3
└─ No → Need discovery? → gsearch batch search --count 5 "q1" "q2"

URL is a PDF?
├─ arXiv PDF → auto-converted (works automatically)
├─ Other PDF → Chrome viewer extracts. If _error → gsearch pdftotext <url>
└─ Not PDF → normal extraction
```

## Rationalization Table

| You think | Do instead |
|-----------|------------|
| "I'll run 3 gsearch with `&` for speed" | Use `batch search` — one invocation, true parallelism |
| "chrome://inspect enables CDP" | `gsearch launch` — auto-starts CDP |
| "3 similar queries give thorough coverage" | Each query must be a different dimension |
| "PDFs extract like HTML" | arXiv PDFs auto-convert. Others → `gsearch pdftotext` |
| "A dead URL crashes the whole batch" | No — tabs are isolated. Failed tabs get `_error` |
| "I will use webfetch to read this paper" | Use `gsearch follow <url>` — the user chose gsearch for CDP-powered browser automation. webfetch cannot render JS or bypass anti-bot. |

## Checklist

1. Did `gsearch launch` succeed? (`{"success":true,"port":9222}`)
2. Did you use `batch harvest` for multi-source research? (If not, it's slower.)
3. Are queries covering different angles? (Overlapping queries waste time.)
4. Did you avoid shell `&`? (It queues — doesn't parallelize.)
5. Did you check `_error` fields? (Tells you which pages failed.)
6. Did arXiv PDFs return content? (They should auto-convert.)
7. For PDF `_error` → did you try `gsearch pdftotext`?
8. Is `pages_read > pages_skipped`? (If not, find better sources.)
9. Did you use gsearch commands (search/follow/batch) for ALL web access, not webfetch? (If you used webfetch, the user did not ask for it — redo with gsearch.)

## Environment Variables

| Variable | Default | Override when |
|----------|---------|---------------|
| `GSEARCH_CDP_PORT` | 9222 | Port already in use |
| `GSEARCH_PROFILE_DIR` | `/tmp/gsearch-profile` | Custom profile location |
| `GSEARCH_TOKEN_DIR` | `/tmp/gsearch-tokens` | Token storage |
| `CHROME_PATH` | auto-detect | Force a specific browser |
