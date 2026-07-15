# gsearch actions — sourced by entry point.
# shellcheck disable=all

cmd_launch() {
  if ensure_browser; then
    local pid
    pid=$(cat "$GSEARCH_TOKEN_DIR/port-$GSEARCH_CDP_PORT" 2>/dev/null || echo 0)
    printf '{"success":true,"pid":%s,"port":%s,"reused":true}\n' "$pid" "$GSEARCH_CDP_PORT"
    return 0
  fi
  force_browser_launch "$GSEARCH_CDP_PORT"
}

cmd_search() {
  local pretty=false count=10
  while [ $# -gt 0 ]; do
    case "$1" in
      --pretty) pretty=true; shift ;;
      --count)  is_num "$2" || die_usage "gsearch: --count must be a number"; count="$2"; shift 2 ;;
      --) shift; break ;;
      -*) die_usage "gsearch: unknown option: $1" ;;
      *) break ;;
    esac
  done
  [ $# -ge 1 ] || die_usage "Usage: gsearch [--pretty] [--count N] <query>"
  local query="$1"; shift
  if [ $# -ge 1 ] && is_num "$1"; then count="$1"; shift; fi
  [ $# -eq 0 ] || die_usage "gsearch: unexpected argument: $1"

  ensure_browser || force_browser_launch "$GSEARCH_CDP_PORT" || exit 2
  ensure_bhjs

  local conn; conn=$(inject_connect "$GSEARCH_CDP_PORT" "const count=$count;")
  local safe_query; safe_query=$(printf '%s' "$query" | sed -e "s/'/\\\\'/g")
  local js="$conn
const ready = session.waitFor(\"Page.lifecycleEvent\", p=>p.name===\"networkIdle\", 30000);
await session.Page.navigate({url:\"https://www.google.com/search?q=\"+encodeURIComponent('$safe_query')+\"&num=\"+count});
await ready;
const r = await session.Runtime.evaluate({
  expression:'JSON.stringify([...document.querySelectorAll(\"a.zReHs\")].slice(0,'+count+').map(el=>({title:(el.querySelector(\"h3\")?.textContent||\"\").trim(),url:el.href||\"\",snippet:((el.closest(\"[data-hveid]\")?.textContent||\"\").split(/D\u1ECBch trang n\u00E0y|B\u1EA3n d\u1ECBch trang n\u00E0y/).pop()||\"\").trim().slice(0,200)})))',
  returnByValue:true
});
try{await session.Target.closeTarget({targetId:__tab.targetId})}catch{}
return JSON.stringify(JSON.parse(r.result.value));"

  local raw; raw=$(printf '%s' "$js" | browser-harness-js 2>&1) || {
    printf '{"tool":"gsearch","error":"search_failed","detail":%s}\n' "$(json_str "$raw")" >&2
    exit 2
  }
  if echo "$raw" | grep -q "Cannot connect"; then
    printf '{"tool":"gsearch","error":"not_connected","detail":%s}\n' "$(json_str "$raw")" >&2; exit 2
  fi
  if $pretty; then
    echo "$raw" | node -e 'let d=require("fs").readFileSync(0,"utf8").trim(); try{let a=JSON.parse(d);a.forEach(r=>console.log((r.title||"")+"\n  "+(r.url||"")+"\n  "+(r.snippet||"")+"\n"));}catch(e){console.log(d);}'
  else
    printf '%s\n' "$raw"
  fi
}

cmd_follow() {
  [ $# -ge 1 ] || die_usage "Usage: gsearch follow <url> [--selector S] [--json-url] [--raw] [--settle MS] [--wait M]"
  local url="" selector="article, main, [role=main]" json_url=false raw=false settle=0 wait="networkIdle"
  while [ $# -gt 0 ]; do
    case "$1" in
      --selector) [ $# -ge 2 ] || die_usage; selector="$2"; shift 2 ;;
      --settle)   [ $# -ge 2 ] || die_usage; is_num "$2" || die_usage; settle="$2"; shift 2 ;;
      --wait)     [ $# -ge 2 ] || die_usage; case "$2" in networkIdle|almostIdle|load) ;; *) die_usage ;; esac; wait="$2"; shift 2 ;;
      --json-url) json_url=true; shift ;; --raw) raw=true; shift ;;
      --) shift; [ $# -ge 1 ] && { url="$1"; shift; }; break ;; -*) die_usage "gsearch follow: unknown option: $1" ;;
      *) [ -z "$url" ] && url="$1" || die_usage "gsearch follow: unexpected: $1"; shift ;;
    esac
  done
  [ -n "$url" ] || die_usage; case "$url" in *://*) ;; *) url="https://$url" ;; esac
  local event; case "$wait" in load) event="load" ;; almostIdle) event="networkAlmostIdle" ;; *) event="networkIdle" ;; esac

  ensure_browser || force_browser_launch "$GSEARCH_CDP_PORT" || exit 2
  ensure_bhjs

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

  local out; out=$(printf '%s' "$js" | browser-harness-js 2>&1) || {
    printf '{"success":false,"url":%s,"error":%s}\n' "$(json_str "$url")" "$(json_str "$out")" >&2; exit 2
  }
  if $raw; then printf '%s\n' "$out"
  else printf '{"success":true,"url":%s,"data":%s}\n' "$(json_str "$url")" "$(json_str "$out")"
  fi
}

cmd_screenshot() {
  [ $# -ge 1 ] || die_usage "Usage: gsearch screenshot <url> [--output FILE] [--settle MS] [--wait M]"
  local url="" output="" settle=0 wait="networkIdle"
  while [ $# -gt 0 ]; do
    case "$1" in
      --output) [ $# -ge 2 ] || die_usage; output="$2"; shift 2 ;;
      --settle) [ $# -ge 2 ] || die_usage; is_num "$2" || die_usage; settle="$2"; shift 2 ;;
      --wait)   [ $# -ge 2 ] || die_usage; case "$2" in networkIdle|almostIdle|load) ;; *) die_usage ;; esac; wait="$2"; shift 2 ;;
      --) shift; [ $# -ge 1 ] && { url="$1"; shift; }; break ;; -*) die_usage "gsearch screenshot: unknown: $1" ;;
      *) [ -z "$url" ] && url="$1" || die_usage "gsearch screenshot: unexpected: $1"; shift ;;
    esac
  done
  [ -n "$url" ] || die_usage; case "$url" in *://*) ;; *) url="https://$url" ;; esac
  [ -z "$output" ] && output="screenshot-$(date +%s).png"
  local event; case "$wait" in load) event="load" ;; almostIdle) event="networkAlmostIdle" ;; *) event="networkIdle" ;; esac

  ensure_browser || force_browser_launch "$GSEARCH_CDP_PORT" || exit 2
  ensure_bhjs

  local conn; conn=$(inject_connect "$GSEARCH_CDP_PORT" "const URL=$(json_str "$url");const EVT=\"$event\";const STTL=$settle;")
  local js="$conn
const ready=session.waitFor(\"Page.lifecycleEvent\",p=>p.name===EVT,30000);
await session.Page.navigate({url:URL});
await ready;
if(STTL>0) await new Promise(r=>setTimeout(r,STTL));
const r=await session.Page.captureScreenshot({format:\"png\",fromSurface:true});
try{await session.Target.closeTarget({targetId:__tab.targetId})}catch{}
return r.data;"

  local b64; b64=$(printf '%s' "$js" | browser-harness-js 2>&1) || {
    printf '{"error":"screenshot_failed","detail":%s}\n' "$(json_str "$b64")" >&2; exit 2
  }
  printf '%s' "$b64" | base64 -d > "$output" 2>/dev/null || {
    printf '{"error":"screenshot_decode_failed"}\n' >&2; exit 2
  }
  printf '{"success":true,"path":"%s","url":%s}\n' "$output" "$(json_str "$url")"
}

cmd_scrape() {
  [ $# -ge 1 ] || die_usage "Usage: gsearch scrape <url> [--selector S] [--attr A] [--list] [--raw] [--settle MS]"
  local url="" selector="article, main, [role=main]" attr="" list=false raw=false settle=0
  while [ $# -gt 0 ]; do
    case "$1" in
      --selector) [ $# -ge 2 ] || die_usage; selector="$2"; shift 2 ;;
      --attr)     [ $# -ge 2 ] || die_usage; attr="$2"; shift 2 ;;
      --list)     list=true; shift ;; --raw) raw=true; shift ;;
      --settle)   [ $# -ge 2 ] || die_usage; is_num "$2" || die_usage; settle="$2"; shift 2 ;;
      --) shift; [ $# -ge 1 ] && { url="$1"; shift; }; break ;; -*) die_usage "gsearch scrape: unknown: $1" ;;
      *) [ -z "$url" ] && url="$1" || die_usage "gsearch scrape: unexpected: $1"; shift ;;
    esac
  done
  [ -n "$url" ] || die_usage; case "$url" in *://*) ;; *) url="https://$url" ;; esac

  ensure_browser || force_browser_launch "$GSEARCH_CDP_PORT" || exit 2
  ensure_bhjs

  local conn; conn=$(inject_connect "$GSEARCH_CDP_PORT" \
    "const URL=$(json_str "$url");const SEL=$(json_str "$selector");const ATR=$(json_str "$attr");const LIST=$list;const STTL=$settle;")
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

  local out; out=$(printf '%s' "$js" | browser-harness-js 2>&1) || {
    printf '{"error":"scrape_failed","detail":%s}\n' "$(json_str "$out")" >&2; exit 2
  }
  if $raw; then printf '%s\n' "$out"
  else printf '{"success":true,"url":%s,"data":%s}\n' "$(json_str "$url")" "$(json_str "$out")"
  fi
}
