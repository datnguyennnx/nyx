# gsearch search — single search via browser-automation.ts
# shellcheck disable=all

cmd_search() {
  local pretty=false count=10
  while [ $# -gt 0 ]; do
    case "$1" in
      --pretty) pretty=true; shift ;;
      --count)  is_num "$2" || die_usage "gsearch: --count must be a number"; count="$2"; shift 2 ;;
      --) shift; break ;;
      -*) die_usage "gsearch: unknown option: $1" ;;
      *) break ;;
    esac
  done
  [ $# -ge 1 ] || die_usage "Usage: gsearch [--pretty] [--count N] <query>"
  local query="$1"

  local raw
  raw=$(bun "${CDP_SCRIPTS}/browser-automation.ts" search "$query" --count "$count" --port "$GSEARCH_CDP_PORT" 2>&1) || {
    printf '{"tool":"gsearch","error":"search_failed","detail":%s}\n' "$(json_str "$raw")" >&2
    exit 2
  }
  if $pretty; then
    echo "$raw" | python3 -m json.tool
  else
    printf '%s\n' "$raw"
  fi
}
