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
  local ok=true
  if ! command -v bun &>/dev/null; then
    echo "  [!] Bun not found. Install: curl -fsSL https://bun.sh/install | bash"
    ok=false
  fi
  for c in \
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    "/Applications/Chromium.app/Contents/MacOS/Chromium" \
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" \
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" \
    "/Applications/Opera.app/Contents/MacOS/Opera" \
    "/Applications/Vivaldi.app/Contents/MacOS/Vivaldi" \
    "/Applications/Arc.app/Contents/MacOS/Arc" \
    "/Applications/Thorium.app/Contents/MacOS/Thorium" \
    "/Applications/Dia.app/Contents/MacOS/Dia" \
    "$HOME/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    "$HOME/Applications/Chromium.app/Contents/MacOS/Chromium" \
    "$HOME/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" \
    "/usr/bin/google-chrome" "/usr/bin/chromium" "/usr/bin/chromium-browser"; do
    [ -x "$c" ] && { found="$c"; break; }
  done
  if [ -z "$found" ]; then
    echo "  [!] No Chromium-based browser found."
    echo "  Install one: brew install --cask google-chrome"
    echo "  Or: https://www.google.com/chrome/"
    ok=false
  fi
  $ok || echo "  Install missing dependencies and re-run."
  $ok
}

install() {
  echo "=== Checking dependencies ==="
  check_deps || exit 1

  echo ""
  echo "=== Installing opencode config ==="
  sync_dir "$DOTFILES/opencode" "$HOME/.config/opencode" "nyx -> .config/opencode"

  echo ""
  echo "=== Installing agents skills ==="
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
  echo "=== Setting up temp directories ==="
  mkdir -p /tmp/gsearch-profile /tmp/gsearch-tokens
  echo "  Created /tmp/gsearch-profile (isolated Chrome profile)"
  echo "  Created /tmp/gsearch-tokens (port tokens)"

  echo ""
  echo "=== Deleting stale skills cache ==="
  rm -f "$HOME/.agents/skills-lock.json"
  echo "  Removed skills-lock.json (will regenerate on next start)"

  echo ""
  echo "+===============================================================+"
  echo "|  Install complete.                                            |"
  echo "+===============================================================+"
  echo "|                                                               |"
  echo "|  What was installed:                                          |"
  echo "|    nyx/opencode/  ->  ~/.config/opencode/  (opencode config). |"
  echo "|    nyx/agents/    ->  ~/.agents/           (skills + tools).  |"
  echo "|    gsearch CLI   ->  ~/.local/bin/gsearch                     |"
  echo "|    browser-harness-js -> ~/.local/bin/browser-harness-js      |"
  echo "|                                                               |"
  echo "|  Quick start:                                                 |"
  echo "|    1. gsearch launch       (start isolated Chrome)            |"
  echo "|    2. gsearch --count 2 \"your topic\"  (first search)        |"
  echo "|                                                               |"
  echo "|  Run tests:                                                   |"
  echo "|    gsearch batch search \"test\"                              |"
  echo "|    bun test ~/.agents/skills/cdp/tests/                       |"
  echo "|                                                               |"
  echo "|  Works with: opencode, Claude Code, Codex, Cline, Pi Agent    |"
  echo "|  (any AI agent can use ~/.agents/skills/ as skill files)      |"
  echo "|                                                               |"
  echo "|  To reinstall: ./bootstrap.sh install                         |"
  echo "|  Source repo:  https://github.com/datnguyennnx/nyx            |"
  echo "+===============================================================+"
}

case "${1:-}" in
  install|--install|-i) install ;;
  *)
    echo "Usage: $(basename "$0") <command>"
    echo "  install  Full first-time setup: sync files, link CLI, check deps, create temp dirs. Run once."
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
