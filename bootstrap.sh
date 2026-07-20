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

check_deps() {
  if ! command -v bun &>/dev/null; then
    echo "  [!] Bun not found. Install: curl -fsSL https://bun.sh/install | bash"
    return 1
  fi
  echo "  bun: found"
}

install() {
  echo "=== Checking dependencies ==="
  check_deps || {
    echo "  Install missing dependencies and re-run."
    exit 1
  }

  echo ""
  echo "=== Installing opencode config ==="
  sync_dir "$DOTFILES/opencode" "$HOME/.config/opencode" "nyx -> .config/opencode"

  echo ""
  echo "=== Installing agent skills ==="
  sync_dir "$DOTFILES/agents" "$HOME/.agents" "nyx -> .agents"

  echo ""
  echo "=== Setting up PATH and symlinks ==="
  local target_dir="$HOME/.local/bin"
  mkdir -p "$target_dir"

  # Link gsearch CLI
  local gsearch_src="$HOME/.agents/skills/gsearch/scripts/gsearch"
  if [ -f "$gsearch_src" ]; then
    ln -sf "$gsearch_src" "$target_dir/gsearch"
    echo "  Linked gsearch -> $target_dir/gsearch"
  fi

  # Link browser-harness-js
  local bhjs_src="$HOME/.agents/skills/cdp/sdk/browser-harness-js"
  if [ -f "$bhjs_src" ]; then
    ln -sf "$bhjs_src" "$target_dir/browser-harness-js"
    echo "  Linked browser-harness-js -> $target_dir/browser-harness-js"
  fi

  # Add ~/.local/bin to PATH if missing
  if ! echo ":$PATH:" | grep -q ":$target_dir:"; then
    local profile=""
    for f in "$HOME/.zshrc" "$HOME/.bashrc" "$HOME/.profile"; do
      [ -f "$f" ] && { profile="$f"; break; }
    done
    if [ -n "$profile" ] && ! grep -q '\.local/bin' "$profile" 2>/dev/null; then
      printf '\nexport PATH="$HOME/.local/bin:$PATH"\n' >> "$profile"
      echo "  Added $target_dir to PATH in $profile"
    fi
    export PATH="$target_dir:$PATH"
  fi

  echo ""
  echo "=== Setting up temp directory ==="
  mkdir -p /tmp/gsearch-profile
  echo "  Created /tmp/gsearch-profile (isolated browser profile)"

  echo ""
  echo "=== Summary ==="
  echo "  opencode config:  ~/.config/opencode/"
  echo "  agent skills:     ~/.agents/"
  echo "  CLI tools:        ~/.local/bin/{gsearch,browser-harness-js}"
  echo "  temp directory:   /tmp/gsearch-profile"
  echo ""
  echo "  Requires: Google Chrome or Dia installed for browser automation."
  echo ""
  echo "  Quick start:"
  echo "    gsearch launch"
  echo "    gsearch --count 2 \"your topic\""
  echo ""
  echo "  To reinstall: $0 install"
  echo "  Repo: https://github.com/datnguyennnx/nyx"
}

case "${1:-}" in
  install|--install|-i) install ;;
  *)
    echo "Usage: $(basename "$0") <command>"
    echo "  install  First-time setup: sync config, skills, link CLI, create temp dir."
    ;;
esac

# NOTE: One-direction sync only
#
# This repo (nyx) is the SINGLE SOURCE OF TRUTH.
# All sync is one direction: repo -> global (~/.config/opencode, ~/.agents).
#
# To apply changes:  ./bootstrap.sh install
#
# NEVER sync from global back to repo. If you modified files in
# ~/.config/opencode or ~/.agents, copy them manually to this repo.
