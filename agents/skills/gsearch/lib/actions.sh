# Action implementations for gsearch — sourced by main entry point.
# shellcheck disable=all

# --- launch: start Chrome with isolated guest profile ---
cmd_launch() {
  echo "Starting Chrome with isolated profile..." >&2
  local profile="/tmp/gsearch-profile-$(date +%s)"
  mkdir -p "$profile"
  local chrome="${CHROME_PATH:-}"
  if [ -z "$chrome" ]; then
    for c in "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
             "/usr/bin/google-chrome" "/usr/bin/chromium" \
             "/usr/bin/chromium-browser" "/opt/homebrew/bin/chromium"; do
      [ -x "$c" ] && { chrome="$c"; break; }
    done
  fi
  [ -n "$chrome" ] || { echo '{"error":"Chrome not found"}' >&2; exit 2; }
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
    echo '{"error":"Chrome failed to start"}' >&2; exit 2
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
