#!/usr/bin/env bash
set -euo pipefail

DOTFILES="$(cd "$(dirname "$0")" && pwd)"

sync_dir() {
  local from="$1" to="$2" label="$3"
  mkdir -p "$to"
  rsync -av --delete \
    --exclude='node_modules/' \
    --exclude='.git/' \
    --exclude='.DS_Store' \
    --exclude='skills-lock.json' \
    --exclude='sync-*.sh' \
    "$from/" "$to/"
  echo "  $label: done"
}

install() {
  echo "--- Installing opencode config ---"
  sync_dir "$DOTFILES/opencode" "$HOME/.config/opencode" "dotfiles → .config/opencode"

  echo ""
  echo "--- Installing agents skills ---"
  sync_dir "$DOTFILES/agents" "$HOME/.agents" "dotfiles → .agents"

  echo ""
  echo "--- Setting up browser-harness-js PATH ---"
  local bhjs_src="$HOME/.agents/skills/cdp/sdk/browser-harness-js"
  local bhjs_target="$HOME/.local/bin/browser-harness-js"
  if [ -f "$bhjs_src" ]; then
    mkdir -p "$HOME/.local/bin"
    ln -sf "$bhjs_src" "$bhjs_target"
    echo "  Linked browser-harness-js → $bhjs_target"
  else
    echo "  browser-harness-js not found at $bhjs_src"
  fi

  echo ""
  echo "Install complete."
  echo ""
  echo "=== Security ==="
  echo "Use 'gsearch launch' to start Chrome with an isolated temp profile."
  echo "Never connect CDP to Chrome with your real profile (cookies/passwords leak)."
  echo ""
  echo "Quick start:"
  echo "  gsearch launch"
  echo "  gsearch --count 2 \"effect-ts\""
}

case "${1:-}" in
  install|--install|-i) install ;;
  *)
    echo "Usage: $(basename "$0") <command>"
    echo "  install  Sync repo  → ~/.config/opencode + ~/.agents"
    ;;
esac

# ══════════════════════════════════════════════════════════════
# NOTE: One-direction sync only
# ══════════════════════════════════════════════════════════════
#
# This repo (nyx) is the SINGLE SOURCE OF TRUTH.
# All sync is one direction: repo → global (~/.config/opencode, ~/.agents).
#
# To apply changes:  ./bootstrap.sh install
#
# NEVER sync from global back to repo. If you modified files in
# ~/.config/opencode or ~/.agents, copy them manually to this repo.
