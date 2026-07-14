# Action implementations for gsearch — sourced by main entry point.
# shellcheck disable=all

# --- launch: start Chrome/Chromium with isolated guest profile ---

# Check if a binary supports Chrome DevTools Protocol (CDP) — i.e. is Chromium-based.
# Uses 'strings' which is fast and safe (does not execute the binary).
# Avoids grep -q + pipefail SIGPIPE issue by using a temp file.
_is_chromium() {
  local bin="$1"
  [ -z "$bin" ] && return 1
  local _tmp_chk
  _tmp_chk=$(mktemp /tmp/gsearch-chk-XXXXXX 2>/dev/null) || _tmp_chk="/tmp/gsearch-chk-$$"
  strings "$bin" 2>/dev/null > "$_tmp_chk"
  grep -q "remote-debugging-port" "$_tmp_chk" 2>/dev/null
  local ret=$?
  rm -f "$_tmp_chk"
  return $ret
}

# Detect the system's default web browser and check if it is Chromium-based.
# Returns the path to the default browser binary if Chromium-based, or empty.
_detect_default_chrome() {
  local bundle_id="" app_path=""

  # macOS: Read default HTTPS handler from LaunchServices
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
        if [ -n "$bin" ] && [ -x "$bin" ] && _is_chromium "$bin"; then
          printf '%s' "$bin"
          return 0
        fi
      fi
    fi
  fi

  # Linux: check xdg-mime for default web browser
  if command -v xdg-mime >/dev/null 2>&1; then
    local desktop
    desktop=$(xdg-mime query default x-scheme-handler/https 2>/dev/null || xdg-mime query default text/html 2>/dev/null)
    if [ -n "$desktop" ]; then
      # Look through desktop entry paths
      for dir in "$HOME/.local/share/applications" "/usr/share/applications" "/usr/local/share/applications"; do
        local desktop_file="$dir/$desktop"
        if [ -f "$desktop_file" ]; then
          local exec_line
          exec_line=$(grep '^Exec=' "$desktop_file" | head -1 | sed 's/^Exec=//' | sed 's/%.*//' | sed 's/^\"//;s/\"$//')
          if [ -n "$exec_line" ]; then
            local bin_path
            bin_path=$(command -v "${exec_line%% *}" 2>/dev/null || echo "$exec_line")
            bin_path="${bin_path%% *}"
            if [ -x "$bin_path" ] && _is_chromium "$bin_path"; then
              printf '%s' "$bin_path"
              return 0
            fi
          fi
        fi
      done
    fi
  fi

  return 1
}

# Detect any Chromium-based browser on the system (not the default).
# Returns the path to the browser binary, or empty string if none found.
_detect_chrome() {
  # 1. Common browser paths (ordered by popularity)
  local browsers=(
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    "/Applications/Chromium.app/Contents/MacOS/Chromium"
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
    "/Applications/Opera.app/Contents/MacOS/Opera"
    "/Applications/Vivaldi.app/Contents/MacOS/Vivaldi"
    "/Applications/Arc.app/Contents/MacOS/Arc"
    "/Applications/Dia.app/Contents/MacOS/Dia"
    "/Applications/Thorium.app/Contents/MacOS/Thorium"
    "/Applications/Naver Whale.app/Contents/MacOS/Naver Whale"
    "/Applications/Slimjet.app/Contents/MacOS/Slimjet"
    "/Applications/Yandex Browser.app/Contents/MacOS/Yandex Browser"
    "/opt/homebrew/bin/chromium"
    "/usr/local/bin/chromium"
    "/usr/bin/google-chrome"
    "/usr/bin/chromium"
    "/usr/bin/chromium-browser"
    "$HOME/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    "$HOME/Applications/Chromium.app/Contents/MacOS/Chromium"
    "$HOME/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
    "$HOME/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
  )
  local c
  for c in "${browsers[@]}"; do
    [ -x "$c" ] && { printf '%s' "$c"; return 0; }
  done

  # 3. macOS Spotlight search for any Chromium-based browser not in common paths
  if command -v mdfind >/dev/null 2>&1; then
    while IFS= read -r app; do
      name="$(basename "$app" .app)"
      # Check if the app name suggests Chromium-based
      case "$name" in
        *[Cc]hrom*|*[Ee]dge*|*[Bb]rave*|*[Oo]pera*|*[Vv]ivaldi*|*[Aa]rc*|*[Dd]ia*|*[Tt]horium*|*[Ss]limjet*|*[Ww]hale*|*[Yy]andex*)
          bin="$app/Contents/MacOS/$name"
          [ -x "$bin" ] || bin="$app/Contents/MacOS/$(basename "$app" .app | tr '[:upper:]' '[:lower:]')"
          [ -x "$bin" ] || bin=$(find "$app/Contents/MacOS" -maxdepth 1 -type f -perm +111 2>/dev/null | head -1)
          if [ -n "$bin" ] && [ -x "$bin" ] && _is_chromium "$bin"; then
            found="$bin"
            break
          fi
          ;;
      esac
    done < <(mdfind "kMDItemKind == 'Application'" 2>/dev/null | head -100)
    if [ -n "${found:-}" ]; then
      printf '%s' "$found"
      return 0
    fi
  fi

  # 4. Check PATH for any chromium/chrome variant
  local path_bin
  path_bin=$(command -v chromium chrome chromium-browser google-chrome 2>/dev/null | head -1)
  if [ -n "$path_bin" ] && [ -x "$path_bin" ]; then
    printf '%s' "$path_bin"
    return 0
  fi

  return 1
}

# Install Chromium using available package manager.
_install_chrome() {
  echo "No Chromium-based browser found. Attempting to install Chromium..." >&2

  # macOS: Homebrew
  if command -v brew >/dev/null 2>&1; then
    echo "Installing Chromium via Homebrew..." >&2
    brew install --cask chromium 2>&1 || {
      echo "Homebrew cask failed, trying brew formula..." >&2
      brew install chromium 2>&1 || {
        echo '{"error":"Failed to install Chromium via Homebrew"}' >&2
        exit 2
      }
    }
    local installed="/opt/homebrew/bin/chromium"
    if [ -x "$installed" ]; then
      printf '%s' "$installed"
      return 0
    fi
    # Check Applications too
    if [ -x "/Applications/Chromium.app/Contents/MacOS/Chromium" ]; then
      printf '%s' "/Applications/Chromium.app/Contents/MacOS/Chromium"
      return 0
    fi
    echo '{"error":"Chromium installed but binary not found at expected path"}' >&2
    exit 2
  fi

  # Linux: apt-get
  if command -v apt-get >/dev/null 2>&1; then
    echo "Installing Chromium via apt-get..." >&2
    sudo apt-get update -qq && sudo apt-get install -y -qq chromium-browser 2>&1 || {
      echo '{"error":"Failed to install Chromium via apt-get"}' >&2
      exit 2
    }
    command -v chromium-browser chromium google-chrome 2>/dev/null | head -1 && return 0
    echo '{"error":"Chromium installed but not found in PATH"}' >&2
    exit 2
  fi

  # Linux: dnf/yum
  if command -v dnf >/dev/null 2>&1; then
    echo "Installing Chromium via dnf..." >&2
    sudo dnf install -y chromium 2>&1 || {
      echo '{"error":"Failed to install Chromium via dnf"}' >&2
      exit 2
    }
    command -v chromium 2>/dev/null | head -1 && return 0
    echo '{"error":"Chromium installed but not found in PATH"}' >&2
    exit 2
  fi
  if command -v yum >/dev/null 2>&1; then
    echo "Installing Chromium via yum..." >&2
    sudo yum install -y chromium 2>&1 || {
      echo '{"error":"Failed to install Chromium via yum"}' >&2
      exit 2
    }
    command -v chromium 2>/dev/null | head -1 && return 0
    echo '{"error":"Chromium installed but not found in PATH"}' >&2
    exit 2
  fi

  # Linux: pacman (Arch)
  if command -v pacman >/dev/null 2>&1; then
    echo "Installing Chromium via pacman..." >&2
    sudo pacman -S --noconfirm chromium 2>&1 || {
      echo '{"error":"Failed to install Chromium via pacman"}' >&2
      exit 2
    }
    command -v chromium 2>/dev/null | head -1 && return 0
    echo '{"error":"Chromium installed but not found in PATH"}' >&2
    exit 2
  fi

  # No known package manager
  echo '{"error":"No Chromium-based browser found. Please install one manually (e.g. \"brew install --cask chromium\")."}' >&2
  exit 2
}

cmd_launch() {
  local profile="/tmp/gsearch-profile-$(date +%s)"
  mkdir -p "$profile"

  # Detect browser — priority order:
  #   1. $CHROME_PATH env var (explicit user override)
  #   2. System default browser (if Chromium-based)
  #   3. Any installed Chromium-based browser
  #   4. Auto-install Chromium
  local chrome=""

  # Step 1: CHROME_PATH env var
  if [ -z "$chrome" ] && [ -n "${CHROME_PATH:-}" ] && [ -x "$CHROME_PATH" ]; then
    chrome="$CHROME_PATH"
    echo "Using browser from CHROME_PATH: $chrome" >&2
  fi

  # Step 2: System default browser (if Chromium-based)
  if [ -z "$chrome" ]; then
    chrome=$(_detect_default_chrome) && echo "Using default browser: $chrome" >&2 || true
  fi

  # Step 3: Any Chromium-based browser
  if [ -z "$chrome" ]; then
    chrome=$(_detect_chrome) && echo "Using detected browser: $chrome" >&2 || true
  fi

  # Step 4: Auto-install
  if [ -z "$chrome" ]; then
    echo "No Chromium-based browser found. Attempting to install..." >&2
    chrome=$(_install_chrome)
    echo "Installed browser: $chrome" >&2
  fi

  echo "Using browser: $chrome" >&2
  "$chrome" --remote-debugging-port="$GSEARCH_CDP_PORT" --user-data-dir="$profile" \
    --no-first-run --no-default-browser-check --new-window "about:blank" >/dev/null 2>&1 &
  local pid=$!
  for i in $(seq 1 30); do
    sleep 0.5
    curl -sS "http://127.0.0.1:$GSEARCH_CDP_PORT/json/version" >/dev/null 2>&1 && break
  done
  if curl -sS "http://127.0.0.1:$GSEARCH_CDP_PORT/json/version" >/dev/null 2>&1; then
    mkdir -p "$GSEARCH_TOKEN_DIR"
    printf '%s' "$pid" > "$GSEARCH_TOKEN_DIR/port-$GSEARCH_CDP_PORT"
    printf '{"success":true,"pid":%d,"profile":"%s","port":%s}\n' "$pid" "$profile" "$GSEARCH_CDP_PORT"
  else
    echo '{"error":"Browser failed to start"}' >&2; exit 2
  fi
}

# --- search: Google search, return JSON array ---
cmd_search() {
  local pretty=false count=10
  while [ $# -gt 0 ]; do
    case "$1" in --pretty) pretty=true; shift ;; --count) is_num "$2" || die_usage "gsearch: --count must be a number"; count="$2"; shift 2 ;;
      --) shift; break ;; -*) die_usage "gsearch: unknown option: $1" ;; *) break ;; esac
  done
  [ $# -ge 1 ] || die_usage "Usage: gsearch [--pretty] [--count N] <query>"
  local query="$1"; shift
  if [ $# -ge 1 ] && is_num "$1"; then count="$1"; shift; fi
  [ $# -eq 0 ] || die_usage "gsearch: unexpected argument: $1"

  local conn; conn=$(inject_connect "$GSEARCH_CDP_PORT" "const count=$count;")
  local js="$conn
const ready = session.waitFor(\"Page.lifecycleEvent\", p=>p.name===\"networkIdle\", 30000);
await session.Page.navigate({url:\"https://www.google.com/search?q=\"+encodeURIComponent('$(printf '%s' "$query" | sed -e "s/'/\\\\'/g")')+\"&num=\"+count});
await ready;
const r = await session.Runtime.evaluate({
  expression:'JSON.stringify([...document.querySelectorAll(\"a.zReHs\")].slice(0,'+count+').map(el=>({title:(el.querySelector(\"h3\")?.textContent||\"\").trim(),url:el.href||\"\",snippet:((el.closest(\"[data-hveid]\")?.textContent||\"\").split(/Dịch trang này|Bản dịch trang này/).pop()||\"\").trim().slice(0,200)})))',
  returnByValue:true
});
try{await session.Target.closeTarget({targetId:__tab.targetId})}catch{}
return JSON.stringify(JSON.parse(r.result.value));"

  check_trusted_chrome; ensure_bhjs
  local raw; raw=$(printf '%s' "$js" | browser-harness-js 2>&1) || {
    echo "{\"error\":\"search failed\",\"detail\":$(json_str "$raw")}" >&2; exit 2
  }
  if echo "$raw" | grep -q "Cannot connect"; then
    echo "{\"error\":\"browser not reachable\",\"detail\":$(json_str "$raw")}" >&2; exit 2
  fi
  if $pretty; then
    echo "$raw" | node -e '
      let d=require("fs").readFileSync(0,"utf8").trim();
      try{let a=JSON.parse(d);a.forEach(r=>console.log((r.title||"")+"\n  "+(r.url||"")+"\n  "+(r.snippet||"")+"\n"));}catch(e){console.log(d);}'
  else
    printf '%s\n' "$raw"
  fi
}

# --- follow: open URL, return text or JSON ---
cmd_follow() {
  [ $# -lt 1 ] && die_usage "Usage: gsearch follow <url> [--selector S] [--json-url] [--raw] [--settle MS] [--wait M]"
  local url="" selector="article, main, [role=main]" json_url=false raw=false settle=0 wait="networkIdle"
  while [ $# -gt 0 ]; do
    case "$1" in
      --selector) [ $# -ge 2 ] || die_usage "gsearch follow: --selector requires a value"; selector="$2"; shift 2 ;;
      --settle)   [ $# -ge 2 ] || die_usage "gsearch follow: --settle requires ms"; is_num "$2" || die_usage "gsearch follow: --settle must be a number"; settle="$2"; shift 2 ;;
      --wait)     [ $# -ge 2 ] || die_usage "gsearch follow: --wait requires networkIdle|almostIdle|load"; case "$2" in networkIdle|almostIdle|load) ;; *) die_usage "gsearch follow: --wait must be networkIdle|almostIdle|load" ;; esac; wait="$2"; shift 2 ;;
      --json-url) json_url=true; shift ;; --raw) raw=true; shift ;;
      --) shift; [ $# -ge 1 ] && { url="$1"; shift; }; break ;; -*) die_usage "gsearch follow: unknown option: $1" ;;
      *) [ -z "$url" ] && url="$1" || die_usage "gsearch follow: unexpected argument: $1"; shift ;;
    esac
  done
  [ -n "$url" ] || die_usage "Usage: gsearch follow <url> [options]"
  case "$url" in *://*) ;; *) url="https://$url" ;; esac
  local event; case "$wait" in load) event="load" ;; almostIdle) event="networkAlmostIdle" ;; *) event="networkIdle" ;; esac

  local conn; conn=$(inject_connect "$GSEARCH_CDP_PORT" "const URL=$(json_str "$url");const SEL=$(json_str "$selector");const JSON_URL=$json_url;const EVT=\"$event\";const STTL=$settle;")
  local js
  if $json_url; then
    js="$conn
await session.Page.navigate({url:URL});
const poll = () => { var t=document.body?.innerText; if(!t) return JSON.stringify({ready:false,ct:document.contentType,len:0}); try{return JSON.stringify({ready:true,value:JSON.parse(t)})}catch(e){return JSON.stringify({ready:false,ct:document.contentType,len:t.length,head:t.slice(0,140)})} };
const start=Date.now();
while(Date.now()-start<15000) {
  await new Promise(r=>setTimeout(r,80));
  const r=await session.Runtime.evaluate({expression:'('+poll.toString()+')()',returnByValue:true});
  if(r.exceptionDetails) throw new Error('JSON eval failed');
  const v=JSON.parse(r.result.value);
  if(v.ready) { try{await session.Target.closeTarget({targetId:__tab.targetId})}catch{} return JSON.stringify(v.value); }
  if(v.ct&&/text\\/html/i.test(v.ct)&&v.len>0) throw new Error('Non-JSON response');
}
throw new Error('Timeout waiting for JSON');"
  else
    js="$conn
const ready = session.waitFor(\"Page.lifecycleEvent\", p=>p.name===EVT, 30000);
await session.Page.navigate({url:URL});
await ready;
if(STTL>0) await new Promise(r=>setTimeout(r,STTL));
const r = await session.Runtime.evaluate({expression:\"document.querySelector(\"+JSON.stringify(SEL)+\")?.innerText||document.body?.innerText||''\",returnByValue:true});
try{await session.Target.closeTarget({targetId:__tab.targetId})}catch{}
return r.result.value;"
  fi

  check_trusted_chrome; ensure_bhjs
  local out; out=$(printf '%s' "$js" | browser-harness-js 2>&1) || {
    echo "{\"success\":false,\"url\":$(json_str "$url"),\"error\":$(json_str "$out")}" >&2; exit 2
  }
  if $raw; then printf '%s\n' "$out"
  else printf '{"success":true,"url":%s,"data":%s}\n' "$(json_str "$url")" "$(json_str "$out")"
  fi
}

# --- screenshot: capture page as PNG ---
cmd_screenshot() {
  [ $# -lt 1 ] && die_usage "Usage: gsearch screenshot <url> [--output FILE] [--settle MS] [--wait M]"
  local url="" output="" settle=0 wait="networkIdle"
  while [ $# -gt 0 ]; do
    case "$1" in
      --output) [ $# -ge 2 ] || die_usage "gsearch screenshot: --output requires path"; output="$2"; shift 2 ;;
      --settle) [ $# -ge 2 ] || die_usage "gsearch screenshot: --settle requires ms"; is_num "$2" || die_usage "gsearch screenshot: --settle must be a number"; settle="$2"; shift 2 ;;
      --wait)   [ $# -ge 2 ] || die_usage "gsearch screenshot: --wait requires networkIdle|almostIdle|load"; case "$2" in networkIdle|almostIdle|load) ;; *) die_usage "gsearch screenshot: --wait must be networkIdle|almostIdle|load" ;; esac; wait="$2"; shift 2 ;;
      --) shift; [ $# -ge 1 ] && { url="$1"; shift; }; break ;; -*) die_usage "gsearch screenshot: unknown option: $1" ;;
      *) [ -z "$url" ] && url="$1" || die_usage "gsearch screenshot: unexpected argument: $1"; shift ;;
    esac
  done
  [ -n "$url" ] || die_usage "Usage: gsearch screenshot <url> [--output FILE]"
  case "$url" in *://*) ;; *) url="https://$url" ;; esac
  [ -z "$output" ] && output="screenshot-$(date +%s).png"

  local event; case "$wait" in load) event="load" ;; almostIdle) event="networkAlmostIdle" ;; *) event="networkIdle" ;; esac
  local conn; conn=$(inject_connect "$GSEARCH_CDP_PORT" "const URL=$(json_str "$url");const EVT=\"$event\";const STTL=$settle;")
  local js="$conn
const ready=session.waitFor(\"Page.lifecycleEvent\",p=>p.name===EVT,30000);
await session.Page.navigate({url:URL});
await ready;
if(STTL>0) await new Promise(r=>setTimeout(r,STTL));
const r=await session.Page.captureScreenshot({format:\"png\",fromSurface:true});
try{await session.Target.closeTarget({targetId:__tab.targetId})}catch{}
return r.data;"

  check_trusted_chrome; ensure_bhjs
  local b64; b64=$(printf '%s' "$js" | browser-harness-js 2>&1) || {
    echo "{\"error\":\"screenshot failed\",\"detail\":$(json_str "$b64")}" >&2; exit 2
  }
  printf '%s' "$b64" | base64 -d > "$output" 2>/dev/null || {
    echo "{\"error\":\"failed to decode screenshot\"}" >&2; exit 2
  }
  printf '{"success":true,"path":"%s","url":%s}\n' "$output" "$(json_str "$url")"
}

# --- scrape: extract structured data via CSS selector ---
cmd_scrape() {
  [ $# -lt 1 ] && die_usage "Usage: gsearch scrape <url> [--selector S] [--attr A] [--list] [--raw] [--settle MS]"
  local url="" selector="article, main, [role=main]" attr="" list=false raw=false settle=0
  while [ $# -gt 0 ]; do
    case "$1" in
      --selector) [ $# -ge 2 ] || die_usage "gsearch scrape: --selector requires CSS"; selector="$2"; shift 2 ;;
      --attr)     [ $# -ge 2 ] || die_usage "gsearch scrape: --attr requires name"; attr="$2"; shift 2 ;;
      --list)     list=true; shift ;; --raw) raw=true; shift ;;
      --settle)   [ $# -ge 2 ] || die_usage "gsearch scrape: --settle requires ms"; is_num "$2" || die_usage "gsearch scrape: --settle must be a number"; settle="$2"; shift 2 ;;
      --) shift; [ $# -ge 1 ] && { url="$1"; shift; }; break ;; -*) die_usage "gsearch scrape: unknown option: $1" ;;
      *) [ -z "$url" ] && url="$1" || die_usage "gsearch scrape: unexpected argument: $1"; shift ;;
    esac
  done
  [ -n "$url" ] || die_usage "Usage: gsearch scrape <url> [--selector S] [--attr A] [--list] [--raw]"
  case "$url" in *://*) ;; *) url="https://$url" ;; esac

  local conn; conn=$(inject_connect "$GSEARCH_CDP_PORT" \
    "const URL=$(json_str "$url");const SEL=$(json_str "$selector");const ATR=$(json_str "$attr");const LIST=$list;const STTL=$settle;")
  # Build evaluate expression in JS to avoid shell quoting issues
  local js="$conn
const ready=session.waitFor(\"Page.lifecycleEvent\",p=>p.name===\"networkIdle\",30000);
await session.Page.navigate({url:URL});
await ready;
if(STTL>0) await new Promise(r=>setTimeout(r,STTL));
var expr=\"(()=>{var els=document.querySelectorAll(\"+JSON.stringify(SEL)+\");\";
if(LIST){if(ATR!==\"\"){expr+=\"return JSON.stringify([...els].map(function(e){var v=e.getAttribute(\"+JSON.stringify(ATR)+\");return v!==null?v:null}));\"}else{expr+=\"return JSON.stringify([...els].map(function(e){return(e.textContent||null).trim()}));\"}
}else{expr+=\"var el=els[0];if(!el)return null;\";if(ATR!==\"\"){expr+=\"var v=el.getAttribute(\"+JSON.stringify(ATR)+\");return v!==null?v:null;\";}else{expr+=\"return(el.textContent||null).trim();\";}}
expr+=\"})()\";
const r=await session.Runtime.evaluate({expression:expr,returnByValue:true});
try{await session.Target.closeTarget({targetId:__tab.targetId})}catch{}
return r.result.value;"

  check_trusted_chrome; ensure_bhjs
  local out; out=$(printf '%s' "$js" | browser-harness-js 2>&1) || {
    echo "{\"error\":\"scrape failed\",\"detail\":$(json_str "$out")}" >&2; exit 2
  }
  if $raw; then printf '%s\n' "$out"
  else printf '{"success":true,"url":%s,"data":%s}\n' "$(json_str "$url")" "$(json_str "$out")"
  fi
}
