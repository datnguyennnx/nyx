# gsearch follow — follow, screenshot, scrape commands
# shellcheck disable=all

cmd_follow() {
  [ $# -ge 1 ] || die_usage "Usage: gsearch follow <url> [--selector S] [--json-url] [--raw] [--offset N] [--max N] [--settle MS] [--wait M]"
  local url="" selector="article, main, [role=main]" json_url=false raw=false pretty=false offset=0 max=15000 settle=0 wait="networkIdle"
  while [ $# -gt 0 ]; do
    case "$1" in
      --selector) [ $# -ge 2 ] || die_usage; selector="$2"; shift 2 ;;
      --offset)   [ $# -ge 2 ] || die_usage; is_num "$2" || die_usage; offset="$2"; shift 2 ;;
      --max)      [ $# -ge 2 ] || die_usage; is_num "$2" || die_usage; max="$2"; shift 2 ;;
      --pretty)   pretty=true; shift ;;
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

  CDP_SCRIPTS="${CDP_SCRIPTS:-$(cd "$(dirname "$BASH_SOURCE")/../../cdp/scripts" && pwd)}"
  local out; out=$(bun "${CDP_SCRIPTS}/browser-automation.ts" follow "$url" --selector "$selector" --offset "$offset" --max "$max" --timeout "30000" --port "$GSEARCH_CDP_PORT" $($pretty && echo --pretty) --raw 2>&1) || {
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
if(LIST){if(ATR!==\"\"){expr+=\"return JSON.stringify([...els].map(function(e){var v=e.getAttribute(\"+JSON.stringify(ATR)+\");return v!==null?v:null;}));\"}else{expr+=\"return JSON.stringify([...els].map(function(e){return(e.textContent||null).trim()}));\"}
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
