# gsearch — generic Chromium browser automation for AI agents.
# shellcheck disable=all
# Principles:
#  - No hardcoded browser names/paths (detect from env/processes)
#  - Profile dir read from process args, not hardcoded paths
#  - Every config has env override

# ════════════════════════════════════════════════════════════════════
# CONFIG (all overridable via env)
# ════════════════════════════════════════════════════════════════════

GSEARCH_CDP_PORT="${GSEARCH_CDP_PORT:-9222}"
GSEARCH_TOKEN_DIR="${GSEARCH_TOKEN_DIR:-/tmp/gsearch-tokens}"
GSEARCH_PROFILE_DIR="${GSEARCH_PROFILE_DIR:-/tmp/gsearch-profile}"
CHROME_PATH="${CHROME_PATH:-}"

# ════════════════════════════════════════════════════════════════════
# GENERIC BROWSER DETECTION
# ════════════════════════════════════════════════════════════════════

# Extract app display name from a browser executable path.
_app_name() {
  local path="$1"
  case "$path" in
    *"/Google Chrome.app/"*)  printf 'Google Chrome' ;;
    *"/Dia.app/"*)            printf 'Dia' ;;
    *)                        basename "$(dirname "$(dirname "$path")")" .app ;;
  esac
}

# Find DevToolsActivePort files anywhere under ~/Library/Application Support
_scan_devtools_active_ports() {
  find "$HOME/Library/Application Support" -name "DevToolsActivePort" -maxdepth 5 2>/dev/null
}

# Find the real profile directory for a browser (not our temp profile).
_real_profile_dir() {
  local target_app="$1" dir

  # If a specific browser was requested, check its path first
  case "$target_app" in
    *[Dd]ia*)        dir="$HOME/Library/Application Support/Dia/User Data" ;;
    *[Cc]hrome*)     dir="$HOME/Library/Application Support/Google/Chrome" ;;
    *)               # fallback: check Dia first, then Chrome
                     for dir in "$HOME/Library/Application Support/Dia/User Data" \
                                "$HOME/Library/Application Support/Google/Chrome"; do
                       [ -d "$dir" ] && { printf '%s' "$dir"; return 0; }
                     done ;;
  esac

  if [ -d "$dir" ]; then
    printf '%s' "$dir"
    return 0
  fi
  return 1
}

# ════════════════════════════════════════════════════════════════════
# PORT PROBING (parallel, browser-agnostic)
# ════════════════════════════════════════════════════════════════════

# Check ONE port: HTTP probe or ANY DevToolsActivePort file.
_probe_one() {
  local port="$1"
  local resp
  resp=$(curl -sS --max-time 1 "http://127.0.0.1:$port/json/version" 2>/dev/null)
  if [ -n "$resp" ] && echo "$resp" | python3 -c 'import sys,json; json.load(sys.stdin)' 2>/dev/null; then
    printf '%s' "$port"; return 0
  fi
  # Generic: scan ALL DevToolsActivePort files on the system
  local pf
  while IFS= read -r pf; do
    [ -f "$pf" ] && [ "$(head -1 "$pf" 2>/dev/null)" = "$port" ] && { printf '%s' "$port"; return 0; }
  done < <(_scan_devtools_active_ports)
  return 1
}

# ════════════════════════════════════════════════════════════════════
# CONNECTION MANAGEMENT
# ════════════════════════════════════════════════════════════════════

# Check if a browser is already running on the given CDP port.
# Uses _probe_one which checks:
#   1. HTTP /json/version (Chrome with --remote-debugging-port)
#   2. DevToolsActivePort files (Dia, Chrome inspect mode)
ensure_browser() {
  local port="${1:-$GSEARCH_CDP_PORT}"
  _probe_one "$port" >/dev/null 2>&1
}

# ════════════════════════════════════════════════════════════════════
# LAUNCH NEW BROWSER (generics)
# ════════════════════════════════════════════════════════════════════

force_browser_launch() {
  local port="${1:-$GSEARCH_CDP_PORT}" chrome profile="" real_profile app_name
  chrome=$(_find_browser)
  [ -z "$chrome" ] && { printf '{"tool":"gsearch","error":"no_browser","detail":"No browser found"}\n' >&2; exit 2; }

  # Always prefer real profile if it exists
  app_name=$(_app_name "$chrome")
  real_profile=$(_real_profile_dir "$app_name")
  if [ -n "$real_profile" ]; then
    profile="$real_profile"
  fi
  # Only use temp profile as last resort — no real profile found at all
  if [ -z "$profile" ]; then
    profile="${GSEARCH_PROFILE_DIR:-/tmp/gsearch-profile}"
    _pre_seed_profile "$profile"
  fi

  rm -f "$profile/SingletonLock" "$profile/SingletonSocket" "$profile/SingletonCookie" 2>/dev/null
  find /tmp -maxdepth 1 -name 'gsearch-profile-*' -mmin +60 -exec rm -rf {} + 2>/dev/null || true
  mkdir -p "$profile"

  "$chrome" --remote-debugging-port="$port" --user-data-dir="$profile" \
    --no-first-run --no-default-browser-check --disable-fre "about:blank" >/dev/null 2>&1 &
  local pid=$! i

  for i in $(seq 1 60); do
    sleep 0.2
    _probe_one "$port" >/dev/null && break
  done

  if _probe_one "$port" >/dev/null; then
    printf '{"success":true,"pid":%d,"profile":"%s","port":%s}\n' "$pid" "$profile" "$port"
    return 0
  fi
  printf '{"tool":"gsearch","error":"launch_failed","detail":"Browser failed to start on port %s"}\n' "$port" >&2
  return 1
}

_pre_seed_profile() {
  local dir="$1" now
  now=$(python3 -c 'from datetime import timezone, datetime; print(int(datetime.now(timezone.utc).timestamp()*1000000))' 2>/dev/null || echo "1")
  for sub in "User Data/Default" "Default"; do
    mkdir -p "$dir/$sub"
    cat > "$dir/$sub/Preferences" <<PEOF
{"browser":{"has_seen_welcome_page":true},"profile":{"exit_type":"Normal"},"default_apps_install_state":3,"in_product_help":{"session_last_active_time":"$now","session_number":5,"session_start_time":"$now"}}
PEOF
  done
  for sub in "User Data" "."; do
    mkdir -p "$dir/$sub"
    cat > "$dir/$sub/Local State" <<LEOF
{"browser":{"enabled_labs_experiments":[],"last_redirect_origin":"","last_whats_new_milestone":"150"},"distribution":{"skip_first_run_ui":true}}
LEOF
  done
}

# ════════════════════════════════════════════════════════════════════
# BROWSER BINARY DETECTION
# ════════════════════════════════════════════════════════════════════

_find_browser() {
  [ -n "${CHROME_PATH:-}" ] && [ -x "$CHROME_PATH" ] && { printf '%s' "$CHROME_PATH"; return 0; }
  _detect_default_chrome && return 0
  _detect_chrome && return 0
  _install_chrome && return 0
  return 1
}

# ════════════════════════════════════════════════════════════════════
# DEPENDENCY: browser-harness-js
# ════════════════════════════════════════════════════════════════════

ensure_bhjs() {
  command -v browser-harness-js >/dev/null 2>&1 && return 0
  local bhjs="$HOME/.agents/skills/cdp/sdk/browser-harness-js"
  [ -f "$bhjs" ] || { printf '{"tool":"gsearch","error":"no_bhjs","detail":"browser-harness-js not found","hint":"Install cdp skill first"}\n' >&2; exit 2; }
  mkdir -p "$HOME/.local/bin"
  ln -sf "$bhjs" "$HOME/.local/bin/browser-harness-js"
  export PATH="$HOME/.local/bin:$PATH"
}

# ════════════════════════════════════════════════════════════════════
# JS INJECTION (browser-agnostic connect)
# ════════════════════════════════════════════════════════════════════

inject_connect() {
  local port="$1" extras="${2:-}"
  cat <<EOF
if (!session.isConnected()) {
  try { await session.connect({port: $port}); }
  catch(e) { throw new Error("Cannot connect on port $port"); }
}
$extras
var __tab = await session.Target.createTarget({url:"about:blank",background:true});
await session.Target.attachToTarget({targetId:__tab.targetId,flatten:true});
await session.use(__tab.targetId);
await session.Page.enable();
await session.Page.setLifecycleEventsEnabled({enabled:true});
EOF
}

# ════════════════════════════════════════════════════════════════════
# HELPERS
# ════════════════════════════════════════════════════════════════════

die_usage()  { printf '%s\n' "$1" >&2; exit 1; }
is_num()     { case "$1" in ''|*[!0-9]*) return 1;; *) return 0;; esac }
json_str()   { printf '%s' "$1" | node -e 'process.stdout.write(JSON.stringify(require("fs").readFileSync(0,"utf8").trim()))'; }

# ════════════════════════════════════════════════════════════════════
# CHROMIUM BINARY DETECTION (macOS + Linux)
# ════════════════════════════════════════════════════════════════════

_is_chromium() {
  local bin="$1" _tmp_chk
  [ -z "$bin" ] && return 1
  _tmp_chk=$(mktemp /tmp/gsearch-chk-XXXXXX 2>/dev/null) || _tmp_chk="/tmp/gsearch-chk-$$"
  strings "$bin" 2>/dev/null > "$_tmp_chk"
  grep -q "remote-debugging-port" "$_tmp_chk" 2>/dev/null
  local ret=$?; rm -f "$_tmp_chk"; return $ret
}

_detect_default_chrome() {
  local bundle_id="" app_path=""
  if [ -f "$HOME/Library/Preferences/com.apple.LaunchServices/com.apple.launchservices.secure.plist" ]; then
    bundle_id=$(python3 -c "
import plistlib, os
path = os.path.expanduser('~/Library/Preferences/com.apple.LaunchServices/com.apple.launchservices.secure.plist')
try:
    pl = plistlib.load(open(path, 'rb'))
    for h in pl.get('LSHandlers', []):
        if h.get('LSHandlerURLScheme') == 'https':
            print(h.get('LSHandlerRoleAll', ''))
            break
except: pass
" 2>/dev/null)
    if [ -n "$bundle_id" ]; then
      app_path=$(mdfind "kMDItemCFBundleIdentifier == '$bundle_id'" 2>/dev/null | head -1)
      if [ -n "$app_path" ]; then
        local bin="$app_path/Contents/MacOS/$(basename "$app_path" .app)"
        [ -x "$bin" ] || bin=$(find "$app_path/Contents/MacOS" -maxdepth 1 -type f -perm +111 2>/dev/null | head -1)
        [ -n "$bin" ] && [ -x "$bin" ] && _is_chromium "$bin" && { printf '%s' "$bin"; return 0; }
      fi
    fi
  fi
  return 1
}

_detect_chrome() {
  local c browsers=(
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    "/Applications/Dia.app/Contents/MacOS/Dia"
    "$HOME/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  )
  for c in "${browsers[@]}"; do [ -x "$c" ] && { printf '%s' "$c"; return 0; }; done
  if command -v mdfind >/dev/null 2>&1; then
    while IFS= read -r app; do
      name="$(basename "$app" .app)"
      bin="$app/Contents/MacOS/$name"
      [ -x "$bin" ] || bin="$app/Contents/MacOS/$(basename "$app" .app | tr '[:upper:]' '[:lower:]')"
      [ -x "$bin" ] || bin=$(find "$app/Contents/MacOS" -maxdepth 1 -type f -perm +111 2>/dev/null | head -1)
      [ -n "$bin" ] && [ -x "$bin" ] && _is_chromium "$bin" && { printf '%s' "$bin"; return 0; }
    done < <(mdfind "kMDItemKind == 'Application'" 2>/dev/null | head -100)
  fi
  c=$(command -v chrome google-chrome 2>/dev/null | head -1)
  [ -n "$c" ] && [ -x "$c" ] && { printf '%s' "$c"; return 0; }
  return 1
}

_install_chrome() {
  echo "Chrome not found. Installing via Homebrew..." >&2
  brew install --cask google-chrome 2>&1 || { echo "Homebrew install failed" >&2; exit 2; }
  local installed="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  if [ -x "$installed" ]; then
    printf '%s' "$installed"
    return 0
  fi
  echo "Installed Chrome not found at expected path" >&2
  exit 2
}
