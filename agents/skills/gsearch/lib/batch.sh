# gsearch batch — parallel/multi-tab batch operations via browser-automation.ts
# shellcheck disable=all

# ═══════════════════════════════════════════════════════════════════════
# BATCH / PARALLEL OPERATIONS (information-theoretic multi-tab)
# ═══════════════════════════════════════════════════════════════════════

# — batch search: multiple queries in parallel tabs, dedup by URL, sort by density
cmd_batch_search() {
  local count=5
  while [ $# -gt 0 ]; do
    case "$1" in
      --count) is_num "$2" || die_usage "gsearch batch search: --count must be a number"; count="$2"; shift 2 ;;
      --) shift; break ;;
      -*) die_usage "gsearch batch search: unknown option: $1" ;;
      *) break ;;
    esac
  done
  [ $# -ge 1 ] || die_usage "Usage: gsearch batch search [--count N] query1 query2 ..."

  local raw
  raw=$(bun "${CDP_SCRIPTS}/browser-automation.ts" batch-search "$@" --count "$count" --port "$GSEARCH_CDP_PORT" 2>&1) || {
    printf '{"tool":"gsearch","error":"batch_search_failed","detail":%s}\n' "$(json_str "$raw")" >&2
    exit 2
  }
  printf '%s\n' "$raw"
}

# — batch follow: multiple URLs in parallel tabs, returns combined content
cmd_batch_follow() {
  local selector="article, main, [role=main]" raw=false
  while [ $# -gt 0 ]; do
    case "$1" in
      --selector) [ $# -ge 2 ] || die_usage; selector="$2"; shift 2 ;;
      --raw) raw=true; shift ;;
      --) shift; break ;;
      -*) die_usage "gsearch batch follow: unknown option: $1" ;;
      *) break ;;
    esac
  done
  [ $# -ge 1 ] || die_usage "Usage: gsearch batch follow [--selector S] url1 url2 ..."

  # Rewrite arXiv PDF URLs to abstract pages before passing to browser-automation.ts
  local urls=()
  local u
  for u in "$@"; do
    case "$u" in
      *arxiv.org/pdf/*)
        u="${u/\/arxiv.org\/pdf\//\/arxiv.org\/abs\/}"
        u="${u%.pdf}"
        ;;
    esac
    urls+=("$u")
  done

  local raw_out
  raw_out=$(bun "${CDP_SCRIPTS}/browser-automation.ts" batch-follow "${urls[@]}" --selector "$selector" --timeout 15000 --port "$GSEARCH_CDP_PORT" 2>&1) || {
    printf '{"tool":"gsearch","error":"batch_follow_failed","detail":%s}\n' "$(json_str "$raw_out")" >&2
    exit 2
  }
  if $raw; then printf '%s\n' "$raw_out"
  else printf '%s\n' "$raw_out"
  fi
}

# — batch harvest: full information pipeline
#   Phase 1: parallel search (all queries → dedup → rank by snippet length)
#   Phase 2: parallel follow (top N unique URLs → extract content)
cmd_batch_harvest() {
  local count=5 max_pages=5
  while [ $# -gt 0 ]; do
    case "$1" in
      --count) is_num "$2" || die_usage; count="$2"; shift 2 ;;
      --max)   is_num "$2" || die_usage; max_pages="$2"; shift 2 ;;
      --) shift; break ;;
      -*) die_usage "gsearch batch harvest: unknown option: $1" ;;
      *) break ;;
    esac
  done
  [ $# -ge 1 ] || die_usage "Usage: gsearch batch harvest [--count N] [--max M] query1 query2 ..."

  local raw
  raw=$(bun "${CDP_SCRIPTS}/browser-automation.ts" batch-harvest "$@" --count "$count" --max "$max_pages" --timeout 15000 --port "$GSEARCH_CDP_PORT" 2>&1) || {
    printf '{"tool":"gsearch","error":"batch_harvest_failed","detail":%s}\n' "$(json_str "$raw")" >&2
    exit 2
  }
  printf '%s\n' "$raw"
}

# — batch: dispatch to subcommands
cmd_batch() {
  [ $# -ge 1 ] || die_usage "Usage: gsearch batch <search|follow|harvest> [args...]"
  local sub="$1"; shift
  case "$sub" in
    search)  cmd_batch_search "$@" ;;
    follow)  cmd_batch_follow "$@" ;;
    harvest) cmd_batch_harvest "$@" ;;
    *) die_usage "gsearch batch: unknown subcommand '$sub' (use: search | follow | harvest)" ;;
  esac
}
