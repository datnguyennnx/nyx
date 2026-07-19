# actions.sh — dispatcher for gsearch subcommands
# Sources individual modules. Keep this file small.
# shellcheck disable=all

cmd_launch() {
  if ensure_browser; then
    local pid
    pid=$(cat "$GSEARCH_TOKEN_DIR/port-$GSEARCH_CDP_PORT" 2>/dev/null || echo 0)
    printf '{"success":true,"pid":%s,"port":%s,"reused":true}\n' "$pid" "$GSEARCH_CDP_PORT"
    return 0
  fi
  force_browser_launch "$GSEARCH_CDP_PORT"
}

# Source function modules
. "$(dirname "${BASH_SOURCE[0]}")/search.sh"
. "$(dirname "${BASH_SOURCE[0]}")/follow.sh"
. "$(dirname "${BASH_SOURCE[0]}")/batch.sh"
. "$(dirname "${BASH_SOURCE[0]}")/pdf.sh"
