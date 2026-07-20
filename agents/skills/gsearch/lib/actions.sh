# actions.sh — dispatcher for gsearch subcommands
# Sources individual modules. Keep this file small.
# shellcheck disable=all

cmd_launch() {
  if ensure_browser; then
    printf '{"success":true,"port":%s,"reused":true}\n' "$GSEARCH_CDP_PORT"
    return 0
  fi
  force_browser_launch "$GSEARCH_CDP_PORT"
}

# Source function modules
. "$(dirname "${BASH_SOURCE[0]}")/search.sh"
. "$(dirname "${BASH_SOURCE[0]}")/follow.sh"
. "$(dirname "${BASH_SOURCE[0]}")/batch.sh"
. "$(dirname "${BASH_SOURCE[0]}")/pdf.sh"
