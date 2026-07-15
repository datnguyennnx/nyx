# gsearch — generic Chromium browser automation for AI agents.
# shellcheck disable=all
# Principles:
#  - No hardcoded browser names/paths (detect from env/processes)
#  - Browser-specific inspect URLs (chrome://, edge://, dia://, arc://, ...)
#  - Profile dir read from process args, not hardcoded paths
#  - Every config has env override

# ════════════════════════════════════════════════════════════════════
# CONFIG (all overridable via env)
# ════════════════════════════════════════════════════════════════════

GSEARCH_CDP_PORT="${GSEARCH_CDP_PORT:-9222}"
GSEARCH_TOKEN_DIR="${GSEARCH_TOKEN_DIR:-/tmp/gsearch-tokens}"
GSEARCH_PROFILE_DIR="${GSEARCH_PROFILE_DIR:-/tmp/gsearch-profile}"
CHROME_PATH="${CHROME_PATH:-}"

# Browser app → inspect URL mapping (extensible)
_inspect_url() {
  case "${1:-}" in
    Dia|dia)             echo "dia://inspect/#remote-debugging" ;;
    Arc|arc)             echo "arc://inspect/#remote-debugging" ;;
    *Chrome*|*chromium*) echo "chrome://inspect/#remote-debugging" ;;
    *Edge*|*edge*)       echo "edge://inspect/#remote-debugging" ;;
    *Brave*|*brave*)     echo "brave://inspect/#remote-debugging" ;;
    *Vivaldi*|*vivaldi*) echo "vivaldi://inspect/#remote-debugging" ;;
    *Opera*|*opera*)     echo "opera://inspect/#remote-debugging" ;;
    *)                   echo "chrome://inspect/#remote-debugging" ;;
  esac
}

# ════════════════════════════════════════════════════════════════════
# GENERIC BROWSER DETECTION
# ════════════════════════════════════════════════════════════════════

# Extract app display name from a browser executable path.
_app_name() {
  local path="$1"
  case "$path" in
    *"/Google Chrome.app/"*)  printf 'Google Chrome' ;;
    *"/Microsoft Edge.app/"*) printf 'Microsoft Edge' ;;
    *"/Brave Browser.app/"*)  printf 'Brave Browser' ;;
    *"/Dia.app/"*)            printf 'Dia' ;;
    *"/Arc.app/"*)            printf 'Arc' ;;
    *"/Vivaldi.app/"*)        printf 'Vivaldi' ;;
    *"/Opera.app/"*)          printf 'Opera' ;;
    *"/Chromium.app/"*)       printf 'Chromium' ;;
    *"/Comet.app/"*)          printf 'Comet' ;;
    *"/Thorium.app/"*)        printf 'Thorium' ;;
    *)                        basename "$(dirname "$(dirname "$path")")" .app ;;
  esac
}

# Find ALL browser main processes (not renderer/helper/gpu).
# Returns lines: "PID APP_NAME EXEC_PATH"
_detect_browsers() {
  ps aux 2>/dev/null | awk '
    !/grep/ && !/\-\-type=/ && /\/Applications\/.*\.app\/Contents\/MacOS\// {print $2, $NF}
  ' | while read -r pid exec; do
    [ -z "$pid" ] || [ -z "$exec" ] && continue
    _is_chromium "$exec" 2>/dev/null || continue
    printf '%s|%s|%s\n' "$pid" "$(_app_name "$exec")" "$exec"
  done
}

# Find the first browser that is NOT our debug instance.
_detect_real_browser_pid() {
  _detect_browsers | while IFS='|' read -r pid app exec; do
    # Skip our own debug instance
    ! echo "$exec" | grep -q "\-\-remote-debugging-port" || continue
    printf '%s|%s|%s\n' "$pid" "$app" "$exec"
    break
  done
}

# Get browser app name for the first real browser found.
_detect_real_browser_app() {
  _detect_real_browser_pid | cut -d'|' -f2
}

# Get the browser PID only.
_detect_real_browser_pid_only() {
  _detect_real_browser_pid | cut -d'|' -f1
}

# Read --user-data-dir from a running browser's process args.
# This is the generic way to find any browser's profile, regardless of browser type.
_profile_dir_of() {
  local pid="$1"
  ps -p "$pid" -o command= 2>/dev/null | grep -o '\-\-user-data-dir=[^ ]*' | cut -d= -f2- | head -1
}

# Read --remote-debugging-port from process args.
_debug_port_of() {
  local pid="$1"
  ps -p "$pid" -o command= 2>/dev/null | grep -o '\-\-remote-debugging-port=[^ ]*' | cut -d= -f2- | head -1
}

# Find DevToolsActivePort files anywhere under ~/Library/Application Support
_scan_devtools_active_ports() {
  find "$HOME/Library/Application Support" -name "DevToolsActivePort" -maxdepth 5 2>/dev/null
}

# Find the real profile directory for a browser (not our temp profile).
_real_profile_dir() {
  local pid
  pid=$(_detect_real_browser_pid_only)
  [ -n "$pid" ] && { _profile_dir_of "$pid" && return 0; }
  # Fallback: scan common locations (browser-agnostic)
  local dir
  for dir in "$HOME/Library/Application Support/Dia/User Data" \
             "$HOME/Library/Application Support/Arc/User Data" \
             "$HOME/Library/Application Support/Google/Chrome" \
             "$HOME/Library/Application Support/Chromium" \
             "$HOME/Library/Application Support/Microsoft Edge" \
             "$HOME/Library/Application Support/BraveSoftware/Brave-Browser" \
             "$HOME/Library/Application Support/Vivaldi" \
             "$HOME/Library/Application Support/com.operasoftware.Opera"; do
    [ -d "$dir" ] && { printf '%s' "$dir"; return 0; }
  done
  return 1
}

# Find the profile dir from DevToolsActivePort file path.
# DevToolsActivePort lives at: <profile_dir>/DevToolsActivePort
_profile_dir_from_port_file() {
  local file="$1"
  dirname "$file"
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

# Parallel port scan (ports 9222-9225)
_scan_ports() {
  local -a pids
  local port
  for port in 9222 9223 9224 9225; do
    (_probe_one "$port") &
    pids[$port]=$!
  done
  for i in $(seq 1 30); do
    for port in 9222 9223 9224 9225; do
      if [ -n "${pids[$port]:-}" ] && ! kill -0 "${pids[$port]}" 2>/dev/null; then
        wait "${pids[$port]}" 2>/dev/null && { printf '%s' "$port"; return 0; }
        pids[$port]=""
      fi
    done
    sleep 0.1
  done
  for pid in "${pids[@]}"; do [ -n "$pid" ] && kill "$pid" 2>/dev/null || true; done
  return 1
}

# ════════════════════════════════════════════════════════════════════
# CONNECTION MANAGEMENT
# ════════════════════════════════════════════════════════════════════

_store_token() {
  local port="$1" pid
  pid=$(lsof -i :"$port" -t 2>/dev/null | head -1)
  mkdir -p "$GSEARCH_TOKEN_DIR"
  printf '%s' "${pid:--1}" > "$GSEARCH_TOKEN_DIR/port-${port}"
  GSEARCH_CDP_PORT="$port"
}

ensure_browser() {
  local port token="$GSEARCH_TOKEN_DIR/port-$GSEARCH_CDP_PORT"

  # 1. Owned browser alive
  if [ -f "$token" ]; then
    local existing_pid; existing_pid=$(cat "$token" 2>/dev/null)
    if [ -n "$existing_pid" ] && kill -0 "$existing_pid" 2>/dev/null; then
      if curl -sS --max-time 1 "http://127.0.0.1:$GSEARCH_CDP_PORT/json/version" >/dev/null 2>&1; then
        return 0
      fi
      local pf
      while IFS= read -r pf; do
        [ -f "$pf" ] && [ "$(head -1 "$pf")" = "$GSEARCH_CDP_PORT" ] && return 0
      done < <(_scan_devtools_active_ports)
    fi
    rm -f "$token"
  fi

  # 2. Scan ports (parallel, browser-agnostic)
  port=$(_scan_ports)
  if [ -n "$port" ]; then
    _store_token "$port"
    return 0
  fi

  # 3. Real browser running but no CDP — open inspect page for their specific browser
  local real_line real_pid real_app
  real_line=$(_detect_real_browser_pid)
  real_pid=$(printf '%s' "$real_line" | cut -d'|' -f1)
  real_app=$(printf '%s' "$real_line" | cut -d'|' -f2)
  if [ -n "$real_pid" ] && kill -0 "$real_pid" 2>/dev/null; then
    local url
    url=$(_inspect_url "$real_app")
    open -a "$real_app" "$url" 2>/dev/null || open "$url" 2>/dev/null || true
    printf '{"tool":"gsearch","error":"no_cdp","detail":"%s running without CDP","hint":"Opened %s for you — toggle switch ON (one-time)","action":"toggle_cdp"}\n' "$real_app" "$url" >&2
    exit 2
  fi

  # 4. No browser at all
  return 1
}

# ════════════════════════════════════════════════════════════════════
# LAUNCH NEW BROWSER (generics)
# ════════════════════════════════════════════════════════════════════

force_browser_launch() {
  local port="${1:-$GSEARCH_CDP_PORT}" chrome profile="" real_line real_pid real_profile
  chrome=$(_find_browser)
  [ -z "$chrome" ] && { printf '{"tool":"gsearch","error":"no_browser","detail":"No Chromium browser found"}\n' >&2; exit 2; }

  # Use real profile if browser isn't running, else fallback to temp
  real_line=$(_detect_real_browser_pid)
  real_pid=$(printf '%s' "$real_line" | cut -d'|' -f1)
  real_profile=$(_real_profile_dir)
  if [ -n "$real_profile" ] && [ -z "$real_pid" ]; then
    profile="$real_profile"
  fi
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
    _store_token "$port"
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

run_js() {
  local js="$1" label="${2:-exec}" out
  out=$(printf '%s' "$js" | browser-harness-js 2>&1) || {
    printf '{"tool":"gsearch","error":"%s","detail":%s}\n' "$label" "$(printf '%s' "$out" | node -e 'process.stdout.write(JSON.stringify(require("fs").readFileSync(0,"utf8").trim()))')" >&2
    exit 2
  }
  printf '%s\n' "$out"
}

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
    "/Applications/Chromium.app/Contents/MacOS/Chromium"
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
    "/Applications/Dia.app/Contents/MacOS/Dia"
    "/Applications/Arc.app/Contents/MacOS/Arc"
    "/Applications/Opera.app/Contents/MacOS/Opera"
    "/Applications/Vivaldi.app/Contents/MacOS/Vivaldi"
    "/Applications/Thorium.app/Contents/MacOS/Thorium"
    "$HOME/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    "$HOME/Applications/Chromium.app/Contents/MacOS/Chromium"
    "$HOME/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
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
  c=$(command -v chromium chrome chromium-browser google-chrome 2>/dev/null | head -1)
  [ -n "$c" ] && [ -x "$c" ] && { printf '%s' "$c"; return 0; }
  return 1
}

_install_chrome() {
  printf '{"tool":"gsearch","warning":"no_browser","detail":"No Chromium browser found, attempting install..."}\n' >&2
  if command -v brew >/dev/null 2>&1; then
    brew install --cask chromium 2>&1 || brew install chromium 2>&1 || { printf '{"tool":"gsearch","error":"install_failed","detail":"Homebrew install failed"}\n' >&2; exit 2; }
    for installed in "/opt/homebrew/bin/chromium" "/Applications/Chromium.app/Contents/MacOS/Chromium"; do
      [ -x "$installed" ] && { printf '%s' "$installed"; return 0; }
    done
  fi
  printf '{"tool":"gsearch","error":"install_failed","detail":"Install Chromium manually: brew install --cask chromium"}\n' >&2
  exit 2
}
