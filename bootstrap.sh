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

push() {
  echo "--- Pushing opencode config to dotfiles ---"
  sync_dir "$HOME/.config/opencode" "$DOTFILES/opencode" ".config/opencode → dotfiles"

  echo ""
  echo "--- Pushing agents skills to dotfiles ---"
  sync_dir "$HOME/.agents" "$DOTFILES/agents" ".agents → dotfiles"

  echo ""
  echo "Push complete."
}

case "${1:-}" in
  install|--install|-i) install ;;
  push|--push|-p)       push ;;
  *)
    echo "Usage: $(basename "$0") <command>"
    echo "  install  Sync dotfiles → ~/.config/opencode + ~/.agents (first-time setup)"
    echo "  push     Sync ~/.config/opencode + ~/.agents → dotfiles (save changes)"
    ;;
esac
