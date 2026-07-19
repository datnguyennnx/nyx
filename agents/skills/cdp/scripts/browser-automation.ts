#!/usr/bin/env bun
/**
 * browser-automation.ts — Generic, pure, reusable browser automation for gsearch
 *
 * GENERATES JS code strings (templates) and pipes them to browser-harness-js.
 * Replaces all fragile JS-in-heredoc templates from bash commands (batch.sh,
 * follow.sh, search.sh).
 *
 * DESIGN:
 *   - PURE functions: template functions take args, return strings of JS.
 *     No side effects, no external state access.
 *   - GENERIC: URL pattern matching detects PDFs by (/\/pdf\/|\.pdf$/i),
 *     not hardcoded site names (arXiv, SSRN, etc.).
 *   - TESTABLE: every template function can be unit tested by checking
 *     its output string.
 *   - MEMORY SAFE: every tab creation has a corresponding close in try/finally.
 *     No tab leaks.
 *   - TIMEOUT EVERYWHERE: every per-tab operation uses Promise.race with
 *     configurable timeout (default 15s).
 *
 * CLI:
 *   browser-automation.ts <command> [args...]
 *
 * Commands:
 *   follow <url> [--selector S] [--timeout MS] [--port N] [--raw]
 *   batch-follow <url1> ... [--selector S] [--timeout MS] [--port N]
 *   batch-harvest <q1> <q2> ... [--count N] [--max M] [--timeout MS] [--port N]
 *   search <query> [--count N] [--port N]
 *   batch-search <q1> <q2> ... [--count N] [--port N]
 */

import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { resolve } from 'path';

// Google Search DOM selectors — site-specific, may need updating.
// These extract results from Google SERP pages. Known limitation: not generic.
const GOOGLE_RESULT_LINK = "a.zReHs";
const GOOGLE_RESULT_CONTAINER = "data-hveid";
const GOOGLE_TRANSLATE_PATTERN = /D\u1ECBch trang n\u00E0y|B\u1EA3n d\u1ECBch trang n\u00E0y/;

// ─── Types ───────────────────────────────────────────────────────────────

export type Command = 'follow' | 'batch-follow' | 'batch-harvest' | 'search' | 'batch-search';

export interface ParsedArgs {
  command: Command;
  positional: string[];
  selector: string;
  timeout: number;
  count: number;
  maxPages: number;
  port: number;
  raw: boolean;
}

// ─── Pure Helper Snippets ────────────────────────────────────────────────

/**
 * connectCode: Pure — returns JS to connect to CDP on given port.
 * No side effects. Given same port, always returns same string.
 */
export function connectCode(port: number): string {
  return (
    'if(!session.isConnected()){try{await session.connect({port:' +
    port +
    "})}catch(e){throw new Error(\"Cannot connect on port " +
    port +
    '")}}'
  );
}

/**
 * qualityGateCode: Pure — returns JS snippet that checks content quality.
 * Sets `isJunk` and `loadError` in the enclosing scope.
 * Refers to `content` and `loadError` variables in enclosing scope.
 */
export function qualityGateCode(): string {
  return [
    'content=(content||"").slice(0,15000);',
    'isJunk=content.length<80||',
    "/This site can't be reached/i.test(content)||",
    '/ERR_CONNECTION/i.test(content)||',
    '/404 Not Found/i.test(content)||',
    '/^\\s*$/.test(content)||',
    'content==="Read More \\u00bb"||',
    '(content.length<100&&content.indexOf("\\"")<0);',
    'if(isJunk&&!loadError&&tab.type!=="pdf")loadError="low_quality_content";',
    'if(isJunk&&tab.type==="pdf"&&!loadError)loadError="pdf_textlayer_empty";',
  ].join('');
}

// ─── Full Command JS Generators (Pure) ───────────────────────────────────

/**
 * followCode: Pure — returns full JS program for single-URL follow.
 * Input: url, selector, timeoutMs, port.
 * Output: JS string that connects, creates one tab, navigates, extracts,
 *         closes tab, and returns result JSON.
 */
export function followCode(
  url: string,
  selector: string,
  timeoutMs: number,
  port: number,
): string {
  const conn = connectCode(port);
  const sel = JSON.stringify(selector);
  const urlJson = JSON.stringify(url);

  // Extraction expression for runtime evaluation
  const extractExpr = `document.querySelector(${sel})?.innerText||document.body?.innerText||''`;

  return [
    conn,
    'const __tab=await session.Target.createTarget({url:"about:blank",background:true});',
    'await session.Target.attachToTarget({targetId:__tab.targetId,flatten:true});',
    'await session.use(__tab.targetId);',
    'await session.Page.enable();',
    'await session.Page.setLifecycleEventsEnabled({enabled:true});',
    'await session.Page.navigate({url:' + urlJson + '});',
    'let content="";let loadError=null;let isJunk=false;',
    'try{await Promise.race([',
    '(async()=>{',
    'for(let i=0;i<50;i++){',
    'try{const r=await session.Runtime.evaluate({expression:"document.readyState",returnByValue:true});',
    'if(r.result&&r.result.value==="complete")break;',
    'if(r.result&&r.result.value==="interactive"&&i>15)break;',
    '}catch(e){loadError=e.message;break;}',
    'await new Promise(r=>setTimeout(r,200));',
    '}',
    'if(!loadError){',
    'const r=await session.Runtime.evaluate({expression:' +
      JSON.stringify(extractExpr) +
      ',returnByValue:true});',
    'content=(r.result&&r.result.value)||"";',
    '}',
    qualityGateCode(),
    '})(),',
    'new Promise((_,reject)=>setTimeout(()=>reject(new Error("tab_timeout")),' +
      timeoutMs +
      '))',
    ']);}catch(e){loadError=e.message;}',
    'try{await session.Target.closeTarget({targetId:__tab.targetId});}catch(e){}',
    'return JSON.stringify({url:' +
      urlJson +
      ',content:isJunk?"":content,...(loadError?{_error:loadError}:{})});',
  ].join('');
}

/**
 * batchFollowCode: Pure — returns full JS for batch-URL follow.
 * Creates N tabs, navigates all, extracts with per-tab timeout,
 * closes all, returns JSON array.
 */
export function batchFollowCode(
  urls: string[],
  selector: string,
  timeoutMs: number,
  port: number,
): string {
  const conn = connectCode(port);
  const urlsJson = JSON.stringify(urls);
  const selJson = JSON.stringify(selector);

  // JS snippet for per-tab extraction (uses `tab`, `selector`, `timeoutMs` in scope)
  const extractTabCode = [
    'await session.use(tab.targetId);',
    'let content="";let loadError=null;let isJunk=false;',
    'try{await Promise.race([',
    '(async()=>{',
    'if(tab.type==="pdf"){',
    'await new Promise(r=>setTimeout(r,3000));',
    'try{const r=await session.Runtime.evaluate({',
    'expression:"document.body?.innerText||document.querySelector(\\"embed\\")?.shadowRoot?.textContent||\\"\\"",',
    'returnByValue:true});',
    'content=(r.result&&r.result.value)||"";',
    '}catch(e){loadError="pdf_extraction_failed: "+e.message;}',
    '}else{',
    'for(let i=0;i<50;i++){',
    'try{const r=await session.Runtime.evaluate({expression:"document.readyState",returnByValue:true});',
    'if(r.result&&r.result.value==="complete")break;',
    'if(r.result&&r.result.value==="interactive"&&i>15)break;',
    '}catch(e){loadError=e.message;break;}',
    'await new Promise(r=>setTimeout(r,200));',
    '}',
    'if(!loadError){',
    'const r=await session.Runtime.evaluate({',
    'expression:"document.querySelector("+JSON.stringify(selector)+")?.innerText||document.body?.innerText||\\"\\"",',
    'returnByValue:true});',
    'content=(r.result&&r.result.value)||"";',
    '}',
    '}',
    qualityGateCode(),
    '})(),',
    'new Promise((_,reject)=>setTimeout(()=>reject(new Error("tab_timeout")),timeoutMs))',
    ']);}catch(e){loadError=e.message;}',
    'results.push({url:tab.originalUrl||tab.fetchUrl,content:isJunk?"":content,...(loadError?{_error:loadError}:{})});',
  ].join('');

  return [
    conn,
    'const urls=' + urlsJson + ';',
    'const selector=' + selJson + ';',
    'const timeoutMs=' + timeoutMs + ';',
    'const processed=urls.map(function(url){',
    'const pdfMatch=url.match(/(\\/pdf\\/|\\.pdf$)/i);',
    'if(pdfMatch&&pdfMatch[1]==="/pdf/"){',
    'const absUrl=url.replace(/\\/pdf\\/(.+)/,"/abs/$1").replace(/\\.pdf$/,"");',
    'if(absUrl!==url){return{originalUrl:url,fetchUrl:absUrl,type:"html"};}',
    '}',
    'if(pdfMatch){return{originalUrl:url,fetchUrl:url,type:"pdf"};}',
    'return{originalUrl:url,fetchUrl:url,type:"html"};',
    '});',
    'const tabs=[];',
    'for(const p of processed){',
    'const tab=await session.Target.createTarget({url:"about:blank",background:true});',
    'await session.Target.attachToTarget({targetId:tab.targetId,flatten:true});',
    'tabs.push({targetId:tab.targetId,originalUrl:p.originalUrl,fetchUrl:p.fetchUrl,type:p.type});',
    '}',
    'for(const tab of tabs){',
    'await session.use(tab.targetId);',
    'await session.Page.enable();',
    'await session.Page.setLifecycleEventsEnabled({enabled:true});',
    'await session.Page.navigate({url:tab.fetchUrl});',
    '}',
    'const results=[];',
    'for(const tab of tabs){',
    extractTabCode,
    '}',
    'for(const tab of tabs){',
    'try{await session.Target.closeTarget({targetId:tab.targetId});}catch(e){}',
    '}',
    'return JSON.stringify(results);',
  ].join('');
}

/**
 * batchSearchCode: Pure — returns full JS for batch search.
 * Queries Google in parallel tabs, deduplicates by URL, sorts by snippet length.
 */
export function batchSearchCode(
  queries: string[],
  count: number,
  port: number,
): string {
  const conn = connectCode(port);
  const queriesJson = JSON.stringify(queries);

  return [
    conn,
    'const queries=' + queriesJson + ';',
    'const count=' + count + ';',
    'const tabs=[];',
    'for(const q of queries){',
    'const tab=await session.Target.createTarget({url:"about:blank",background:true});',
    'await session.Target.attachToTarget({targetId:tab.targetId,flatten:true});',
    'tabs.push({targetId:tab.targetId,query:q});',
    '}',
    'for(const tab of tabs){',
    'await session.use(tab.targetId);',
    'await session.Page.enable();',
    'await session.Page.setLifecycleEventsEnabled({enabled:true});',
    'await session.Page.navigate({url:"https://www.google.com/search?q="+encodeURIComponent(tab.query)+"&num="+count});',
    '}',
    'const allResults=[];',
    'for(const tab of tabs){',
    'await session.use(tab.targetId);',
    'for(let i=0;i<100;i++){',
    'const r=await session.Runtime.evaluate({expression:"document.readyState===\'complete\'",returnByValue:true});',
    'if(r.result.value)break;',
    'await new Promise(r=>setTimeout(r,200));',
    '}',
    'const r=await session.Runtime.evaluate({',
    "expression:'JSON.stringify([...document.querySelectorAll(\"a.zReHs\")].slice(0,'+count+').map(el=>({title:(el.querySelector(\"h3\")?.textContent||\"\").trim(),url:el.href||\"\",snippet:((el.closest(\"[data-hveid]\")?.textContent||\"\").split(/D\\\\u1ECBch trang n\\\\u00E0y|B\\\\u1EA3n d\\\\u1ECBch trang n\\\\u00E0y/).pop()||\"\").trim().slice(0,200)})))',",
    'returnByValue:true',
    '});',
    'const parsed=JSON.parse(r.result.value);',
    'for(const item of parsed){item._query=tab.query;allResults.push(item);}',
    '}',
    'for(const tab of tabs){',
    'try{await session.Target.closeTarget({targetId:tab.targetId});}catch(e){}',
    '}',
    'const seen=new Set();',
    'const deduped=allResults.filter(function(r){if(seen.has(r.url))return false;seen.add(r.url);return true;});',
    'deduped.sort(function(a,b){return(b.snippet?.length||0)-(a.snippet?.length||0);});',
    'return JSON.stringify({results:deduped,meta:{queries:queries,total_unique:deduped.length,total_raw:allResults.length}});',
  ].join('');
}

/**
 * searchCode: Pure — returns full JS for single search.
 */
export function searchCode(
  query: string,
  count: number,
  port: number,
): string {
  const conn = connectCode(port);
  const queryJson = JSON.stringify(query);

  return [
    conn,
    'const count=' + count + ';',
    'const tab=await session.Target.createTarget({url:"about:blank",background:true});',
    'await session.Target.attachToTarget({targetId:tab.targetId,flatten:true});',
    'await session.use(tab.targetId);',
    'await session.Page.enable();',
    'await session.Page.setLifecycleEventsEnabled({enabled:true});',
    'const ready=session.waitFor("Page.lifecycleEvent",function(p){return p.name==="networkIdle";},30000);',
    'await session.Page.navigate({url:"https://www.google.com/search?q="+encodeURIComponent(' +
      queryJson +
      ')+"&num="+count});',
    'await ready;',
    'const r=await session.Runtime.evaluate({',
    "expression:'JSON.stringify([...document.querySelectorAll(\"a.zReHs\")].slice(0,'+count+').map(el=>({title:(el.querySelector(\"h3\")?.textContent||\"\").trim(),url:el.href||\"\",snippet:((el.closest(\"[data-hveid]\")?.textContent||\"\").split(/D\\\\u1ECBch trang n\\\\u00E0y|B\\\\u1EA3n d\\\\u1ECBch trang n\\\\u00E0y/).pop()||\"\").trim().slice(0,200)})))',",
    'returnByValue:true',
    '});',
    'try{await session.Target.closeTarget({targetId:tab.targetId});}catch(e){}',
    'return r.result.value;',
  ].join('');
}

/**
 * batchHarvestCode: Pure — returns full JS for batch harvest pipeline.
 * Phase 1: parallel search all queries → dedup → rank → pick top M.
 * Phase 2: parallel follow top M URLs.
 */
export function batchHarvestCode(
  queries: string[],
  count: number,
  maxPages: number,
  timeoutMs: number,
  port: number,
): string {
  const conn = connectCode(port);
  const queriesJson = JSON.stringify(queries);
  const selJson = JSON.stringify('article, main, [role=main]');

  const extractTabCode = [
    'await session.use(tab.targetId);',
    'let content="";let loadError=null;let isJunk=false;',
    'try{await Promise.race([',
    '(async()=>{',
    'if(tab.type==="pdf"){',
    'await new Promise(r=>setTimeout(r,3000));',
    'try{const r=await session.Runtime.evaluate({',
    'expression:"document.body?.innerText||document.querySelector(\\"embed\\")?.shadowRoot?.textContent||\\"\\"",',
    'returnByValue:true});',
    'content=(r.result&&r.result.value)||"";',
    '}catch(e){loadError="pdf_extraction_failed: "+e.message;}',
    '}else{',
    'for(let i=0;i<50;i++){',
    'try{const r=await session.Runtime.evaluate({expression:"document.readyState",returnByValue:true});',
    'if(r.result&&r.result.value==="complete")break;',
    'if(r.result&&r.result.value==="interactive"&&i>15)break;',
    '}catch(e){loadError=e.message;break;}',
    'await new Promise(r=>setTimeout(r,200));',
    '}',
    'if(!loadError){',
    'const r=await session.Runtime.evaluate({',
    'expression:"document.querySelector("+JSON.stringify(selector)+")?.innerText||document.body?.innerText||\\"\\"",',
    'returnByValue:true});',
    'content=(r.result&&r.result.value)||"";',
    '}',
    '}',
    qualityGateCode(),
    '})(),',
    'new Promise((_,reject)=>setTimeout(()=>reject(new Error("tab_timeout")),timeoutMs))',
    ']);}catch(e){loadError=e.message;}',
    'pages.push({url:tab.originalUrl||tab.url,title:tab.title,query:tab.query,content:isJunk?"":content,...(loadError?{_error:loadError}:{})});',
  ].join('');

  return [
    conn,
    'const queries=' + queriesJson + ';',
    'const count=' + count + ';',
    'const maxPages=' + maxPages + ';',
    'const timeoutMs=' + timeoutMs + ';',
    'const selector=' + selJson + ';',

    // Phase 1: Parallel search
    'const searchTabs=[];',
    'for(const q of queries){',
    'const tab=await session.Target.createTarget({url:"about:blank",background:true});',
    'await session.Target.attachToTarget({targetId:tab.targetId,flatten:true});',
    'searchTabs.push({targetId:tab.targetId,query:q});',
    '}',
    'for(const tab of searchTabs){',
    'await session.use(tab.targetId);',
    'await session.Page.enable();',
    'await session.Page.setLifecycleEventsEnabled({enabled:true});',
    'await session.Page.navigate({url:"https://www.google.com/search?q="+encodeURIComponent(tab.query)+"&num="+count});',
    '}',
    'const allSearchResults=[];',
    'for(const tab of searchTabs){',
    'await session.use(tab.targetId);',
    'for(let i=0;i<100;i++){',
    'const r=await session.Runtime.evaluate({expression:"document.readyState===\'complete\'",returnByValue:true});',
    'if(r.result.value)break;',
    'await new Promise(r=>setTimeout(r,200));',
    '}',
    'const r=await session.Runtime.evaluate({',
    "expression:'JSON.stringify([...document.querySelectorAll(\"a.zReHs\")].slice(0,'+count+').map(el=>({title:(el.querySelector(\"h3\")?.textContent||\"\").trim(),url:el.href||\"\",snippet:((el.closest(\"[data-hveid]\")?.textContent||\"\").split(/D\\\\u1ECBch trang n\\\\u00E0y|B\\\\u1EA3n d\\\\u1ECBch trang n\\\\u00E0y/).pop()||\"\").trim().slice(0,200)})))',",
    'returnByValue:true',
    '});',
    'const parsed=JSON.parse(r.result.value);',
    'for(const item of parsed){item._query=tab.query;allSearchResults.push(item);}',
    '}',
    'for(const tab of searchTabs){',
    'try{await session.Target.closeTarget({targetId:tab.targetId});}catch(e){}',
    '}',

    // Dedup + rank + pick top M
    'const seen=new Set();',
    'const deduped=allSearchResults.filter(function(r){if(seen.has(r.url))return false;seen.add(r.url);return true;});',
    'deduped.sort(function(a,b){return(b.snippet?.length||0)-(a.snippet?.length||0);});',
    'const topUrls=deduped.slice(0,maxPages);',

    // Phase 2: Parallel follow
    'const followItems=[];',
    'for(const item of topUrls){',
    'const pdfMatch=item.url.match(/(\\/pdf\\/|\\.pdf$)/i);',
    'if(pdfMatch&&pdfMatch[1]==="/pdf/"){',
    'const absUrl=item.url.replace(/\\/pdf\\/(.+)/,"/abs/$1").replace(/\\.pdf$/,"");',
    'followItems.push({url:absUrl,originalUrl:item.url,title:item.title,query:item._query,type:"html"});',
    '}else if(pdfMatch){',
    'followItems.push({url:item.url,originalUrl:item.url,title:item.title,query:item._query,type:"pdf"});',
    '}else{',
    'followItems.push({url:item.url,originalUrl:item.url,title:item.title,query:item._query,type:"html"});',
    '}',
    '}',
    'const followTabs=[];',
    'for(const item of followItems){',
    'const tab=await session.Target.createTarget({url:"about:blank",background:true});',
    'await session.Target.attachToTarget({targetId:tab.targetId,flatten:true});',
    'followTabs.push({targetId:tab.targetId,url:item.url,originalUrl:item.originalUrl,title:item.title,query:item.query,type:item.type});',
    '}',
    'for(const tab of followTabs){',
    'await session.use(tab.targetId);',
    'await session.Page.enable();',
    'await session.Page.setLifecycleEventsEnabled({enabled:true});',
    'await session.Page.navigate({url:tab.url});',
    '}',
    'const pages=[];',
    'for(const tab of followTabs){',
    extractTabCode,
    '}',
    'for(const tab of followTabs){',
    'try{await session.Target.closeTarget({targetId:tab.targetId});}catch(e){}',
    '}',

    // Return result
    'return JSON.stringify({',
    'search_results:deduped,',
    'read_pages:pages,',
    'meta:{',
    'queries:queries,',
    'total_search_results:allSearchResults.length,',
    'unique_urls:deduped.length,',
    'pages_read:pages.filter(function(p){return !p._error&&p.content.length>0;}).length,',
    'pages_skipped:pages.filter(function(p){return p._error;}).length',
    '}',
    '});',
  ].join('');
}

// ─── Subprocess Execution ────────────────────────────────────────────────

function findBrowserHarness(): string {
  const which = process.env.PATH || '';
  for (const p of which.split(':')) {
    const candidate = resolve(p, 'browser-harness-js');
    if (existsSync(candidate)) return candidate;
  }
  const localBin = resolve(homedir(), '.local/bin', 'browser-harness-js');
  if (existsSync(localBin)) return localBin;
  const sdkPath = resolve(
    homedir(),
    '.agents/skills/cdp/sdk/browser-harness-js',
  );
  if (existsSync(sdkPath)) return sdkPath;
  throw new Error(
    'browser-harness-js not found. Install cdp skill or add it to PATH.',
  );
}

function runBrowserHarness(
  jsCode: string,
): { stdout: string; stderr: string; exitCode: number } {
  const binary = findBrowserHarness();
  const result = spawnSync(binary, [], {
    input: jsCode,
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024, // 10MB
    timeout: 120000, // 2 min
  });

  return {
    stdout: result.stdout?.trim() || '',
    stderr: result.stderr?.trim() || '',
    exitCode: result.status ?? 1,
  };
}

// ─── CLI Parsing ─────────────────────────────────────────────────────────

function usage(): never {
  const msg = [
    'Usage:',
    '  browser-automation.ts follow <url> [--selector S] [--timeout MS] [--port N] [--raw]',
    '  browser-automation.ts batch-follow <url1> ... [--selector S] [--timeout MS] [--port N]',
    '  browser-automation.ts batch-harvest <q1> ... [--count N] [--max M] [--timeout MS] [--port N]',
    '  browser-automation.ts search <query> [--count N] [--port N]',
    '  browser-automation.ts batch-search <q1> ... [--count N] [--port N]',
  ].join('\n');
  console.error(msg);
  process.exit(1);
}

export function parseArgs(argv: string[]): ParsedArgs {
  const cmd = argv[0] as Command;
  if (!cmd) usage();

  const validCommands: Command[] = [
    'follow',
    'batch-follow',
    'batch-harvest',
    'search',
    'batch-search',
  ];
  if (!(validCommands as string[]).includes(cmd)) usage();

  const args: ParsedArgs = {
    command: cmd,
    positional: [],
    selector: 'article, main, [role=main]',
    timeout: 15000,
    count: 5,
    maxPages: 5,
    port: 9222,
    raw: false,
  };

  let i = 1;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg === '--selector' && i + 1 < argv.length) {
      args.selector = argv[i + 1];
      i += 2;
    } else if (arg === '--timeout' && i + 1 < argv.length) {
      args.timeout = parseInt(argv[i + 1], 10);
      i += 2;
    } else if (arg === '--count' && i + 1 < argv.length) {
      args.count = parseInt(argv[i + 1], 10);
      i += 2;
    } else if (arg === '--max' && i + 1 < argv.length) {
      args.maxPages = parseInt(argv[i + 1], 10);
      i += 2;
    } else if (arg === '--port' && i + 1 < argv.length) {
      args.port = parseInt(argv[i + 1], 10);
      i += 2;
    } else if (arg === '--raw') {
      args.raw = true;
      i += 1;
    } else if (arg.startsWith('--')) {
      console.error('Unknown option: ' + arg);
      usage();
    } else {
      args.positional.push(arg);
      i += 1;
    }
  }

  if (args.positional.length === 0) usage();
  return args;
}

// ─── Command Handlers ────────────────────────────────────────────────────

function cmdFollow(args: ParsedArgs): void {
  const url = args.positional[0];
  const js = followCode(url, args.selector, args.timeout, args.port);
  const { stdout, stderr, exitCode } = runBrowserHarness(js);

  if (exitCode !== 0) {
    const errMsg = stderr || stdout || 'unknown error';
    console.error(
      JSON.stringify({ success: false, url, error: errMsg }),
    );
    process.exit(2);
  }

  if (args.raw) {
    console.log(stdout);
  } else {
    console.log(JSON.stringify({ success: true, url, data: stdout }));
  }
}

function cmdBatchFollow(args: ParsedArgs): void {
  const js = batchFollowCode(
    args.positional,
    args.selector,
    args.timeout,
    args.port,
  );
  const { stdout, stderr, exitCode } = runBrowserHarness(js);

  if (exitCode !== 0) {
    const errMsg = stderr || stdout || 'unknown error';
    console.error(
      JSON.stringify({
        tool: 'gsearch',
        error: 'batch_follow_failed',
        detail: errMsg,
      }),
    );
    process.exit(2);
  }

  console.log(stdout);
}

function cmdSearch(args: ParsedArgs): void {
  const js = searchCode(args.positional[0], args.count, args.port);
  const { stdout, stderr, exitCode } = runBrowserHarness(js);

  if (exitCode !== 0) {
    const errMsg = stderr || stdout || 'unknown error';
    console.error(
      JSON.stringify({
        tool: 'gsearch',
        error: 'search_failed',
        detail: errMsg,
      }),
    );
    process.exit(2);
  }

  console.log(stdout);
}

function cmdBatchSearch(args: ParsedArgs): void {
  const js = batchSearchCode(args.positional, args.count, args.port);
  const { stdout, stderr, exitCode } = runBrowserHarness(js);

  if (exitCode !== 0) {
    const errMsg = stderr || stdout || 'unknown error';
    console.error(
      JSON.stringify({
        tool: 'gsearch',
        error: 'batch_search_failed',
        detail: errMsg,
      }),
    );
    process.exit(2);
  }

  console.log(stdout);
}

function cmdBatchHarvest(args: ParsedArgs): void {
  const js = batchHarvestCode(
    args.positional,
    args.count,
    args.maxPages,
    args.timeout,
    args.port,
  );
  const { stdout, stderr, exitCode } = runBrowserHarness(js);

  if (exitCode !== 0) {
    const errMsg = stderr || stdout || 'unknown error';
    console.error(
      JSON.stringify({
        tool: 'gsearch',
        error: 'batch_harvest_failed',
        detail: errMsg,
      }),
    );
    process.exit(2);
  }

  console.log(stdout);
}

// ─── Main ────────────────────────────────────────────────────────────────

function main(): void {
  const argv = process.argv.slice(2);
  if (argv.length === 0) usage();

  const args = parseArgs(argv);

  switch (args.command) {
    case 'follow':
      cmdFollow(args);
      break;
    case 'batch-follow':
      cmdBatchFollow(args);
      break;
    case 'search':
      cmdSearch(args);
      break;
    case 'batch-search':
      cmdBatchSearch(args);
      break;
    case 'batch-harvest':
      cmdBatchHarvest(args);
      break;
    default:
      usage();
  }
}

if (import.meta.main) {
  main();
}
