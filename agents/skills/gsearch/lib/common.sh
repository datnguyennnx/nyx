# Shared helpers for gsearch — sourced by main entry point.
# shellcheck disable=all

# --- SECURITY: enforce guest Chrome ---
check_trusted_chrome() {
  curl -sS "http://127.0.0.1:$GSEARCH_CDP_PORT/json/version" >/dev/null 2>&1 || return 0
  [ -n "${GSEARCH_ALLOW_REAL:-}" ] && return 0
  local token="$GSEARCH_TOKEN_DIR/port-$GSEARCH_CDP_PORT"
  if [ -f "$token" ]; then
    local pid
    pid=$(cat "$token")
    kill -0 "$pid" 2>/dev/null && curl -sS "http://127.0.0.1:$GSEARCH_CDP_PORT/json/version" >/dev/null 2>&1 && return 0
  fi
  echo '{"error":"Chrome not trusted","hint":"Run gsearch launch first, or set GSEARCH_ALLOW_REAL=1 (risky)"}' >&2
  exit 2
}

# --- DEPENDENCY: ensure browser-harness-js is on PATH ---
ensure_bhjs() {
  command -v browser-harness-js >/dev/null 2>&1 && return 0
  local bhjs; bhjs="$(cd "$(dirname "$0")/.." && pwd)/../cdp/sdk/browser-harness-js"
  [ -f "$bhjs" ] || { echo '{"error":"browser-harness-js not found","hint":"Install cdp skill first"}' >&2; exit 2; }
  mkdir -p "$HOME/.local/bin"
  ln -sf "$bhjs" "$HOME/.local/bin/browser-harness-js"
  export PATH="$HOME/.local/bin:$PATH"
}

# --- HELPERS ---
die_usage() { echo "$1" >&2; exit 1; }
is_num()    { case "$1" in ''|*[!0-9]*) return 1;; *) return 0;; esac }

# Generate the connect+preamble JS code shared by all commands.
# Pipe this through node to replace placeholders before passing to browser-harness-js.
# Usage: inject_connect <port> [extra_vars...]
#   extra_vars: "const X=Y;const Z=W;"
inject_connect() {
  local port="$1" extras="${2:-}"
  cat <<EOF
if (!session.isConnected()) {
  const p = $port;
  try {
    const info = await (await fetch("http://127.0.0.1:"+p+"/json/version")).json();
    await session.connect({wsUrl: info.webSocketDebuggerUrl});
  } catch(e) { throw new Error("Cannot connect on port "+p+". Run gsearch launch first."); }
}
$extras
const __tab = await session.Target.createTarget({url:"about:blank",background:true});
await session.Target.attachToTarget({targetId:__tab.targetId,flatten:true});
await session.use(__tab.targetId);
await session.Page.enable();
await session.Page.setLifecycleEventsEnabled({enabled:true});
EOF
}

# Run a JS snippet through browser-harness-js with error handling.
# Usage: run_js <js_code> [error_label]
run_js() {
  local js="$1" label="${2:-exec}"
  local out; out=$(printf '%s' "$js" | browser-harness-js 2>&1) || {
    echo "{\"error\":\"$label failed\",\"detail\":$(printf '%s' "$out" | node -e 'process.stdout.write(JSON.stringify(require("fs").readFileSync(0,"utf8").trim()))')}" >&2
    exit 2
  }
  printf '%s\n' "$out"
}

# JSON-stringify a string value using node
json_str() { printf '%s' "$1" | node -e 'process.stdout.write(JSON.stringify(require("fs").readFileSync(0,"utf8").trim()))'; }
