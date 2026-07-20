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

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

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
  offset: number;
  maxLen: number;
  pretty: boolean;
  stream: boolean;
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

/**
 * extractionCode: Pure — returns a self-executing browser function that extracts
 * structured content. Returns JSON with content, total_length, truncated flag,
 * and section boundaries. All processing happens in-browser — single CDP round-trip.
 */
export function extractionCode(offset: number, maxLen: number, url: string, selector?: string): string {
  const urlJson = JSON.stringify(url);
  const sel = JSON.stringify(selector || 'article, main, [role=main]');
  return `(function(){
    var root=document.querySelector(${sel})||document.body;
    if(!root){return JSON.stringify({url:${urlJson},content:"",total_length:0,returned_length:0,offset:${offset},truncated:false,sections:[]});}
    var fullText=root.innerText||root.textContent||"";
    var totalLen=fullText.length;
    var off=${offset};
    var max=${maxLen};
    if(off<0){off=0;}
    var end=max<0?totalLen:Math.min(off+max,totalLen);
    var content=off<totalLen?fullText.slice(off,end):"";
    
    // Quality gate — only fires for initial read (offset===0)
    var isJunk=off===0&&(content.length<80||
      /This site can't be reached/i.test(content)||
      /ERR_CONNECTION/i.test(content)||
      /404 Not Found/i.test(content)||
      /^\\s*$/.test(content)||
      content==="Read More \\u00bb"||
      (content.length<100&&content.indexOf("\\"")<0));
    
    // Section detection from full text
    var headings=root.querySelectorAll("h1,h2,h3");
    var sections=[];
    for(var i=0;i<headings.length;i++){
      var h=headings[i];
      var hText=(h.innerText||"").trim();
      if(hText&&hText.length>1){
        var idx=fullText.indexOf(hText);
        if(idx>=0){
          sections.push({heading:hText,level:parseInt(h.tagName[1]),offset:idx});
        }
      }
    }
    
    return JSON.stringify({
      url:${urlJson},
      content:isJunk?"":content,
      _error:isJunk?"low_quality_content":undefined,
      total_length:totalLen,
      returned_length:content.length,
      offset:off,
      truncated:max>=0&&totalLen>(off+max),
      sections:sections
    });
  })()`;
}

// ─── Content Cache ──────────────────────────────────────────────
// Disk-based cache keyed by (url, offset, max). Avoids re-fetching.
// Cache location: /tmp/gsearch-cache/<sha256>.json
// TTL: 1 hour (files older than this are re-fetched)

const CACHE_DIR = '/tmp/gsearch-cache';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function cacheKey(url: string, offset: number, max: number): string {
  return createHash('sha256').update(`${url}|${offset}|${max}`).digest('hex');
}

function cacheGet(url: string, offset: number, max: number): string | null {
  try {
    const key = cacheKey(url, offset, max);
    const path = `${CACHE_DIR}/${key}.json`;
    if (!existsSync(path)) return null;
    const stat = statSync(path);
    if (Date.now() - stat.mtimeMs > CACHE_TTL_MS) {
      unlinkSync(path); // expired
      return null;
    }
    return readFileSync(path, 'utf8');
  } catch {
    return null; // cache miss on any error
  }
}

function cacheSet(url: string, offset: number, max: number, data: string): void {
  try {
    const key = cacheKey(url, offset, max);
    if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(`${CACHE_DIR}/${key}.json`, data, 'utf8');
  } catch {
    // Cache write failure is non-fatal
  }
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
  offset: number,
  maxLen: number,
  timeout: number,
  raw: boolean,
  selector: string,
  port: number
): string {
  const urlJson = JSON.stringify(url);
  const sel = JSON.stringify(selector);
  const extractFunc = extractionCode(offset, maxLen, url, selector);

  return [
    'return (async function(){',
    'var errors=[];var loadError=null;',
    `if(!session.isConnected()){try{await session.connect({port:${port}})}catch(e){throw new Error("CDP connect: "+e.message);}}`,
    // Create tab with about:blank — no navigation yet
    `var {targetId, sessionId}=await session.createTarget({url:"about:blank",background:true});`,
    'try{',
    'await session.use(targetId);',
    'await session.Page.enable();',
    'await session.Page.setLifecycleEventsEnabled({enabled:true});',
    // Register listener BEFORE navigating (CAN'T miss the event)
    `var navPromise=session.waitFor("Page.lifecycleEvent",function(p){return p.name==="networkIdle";},${timeout});`,
    // Single navigation — events already flowing
    `await session.Page.navigate({url:${urlJson}});`,
    'try{await navPromise;}catch(e){loadError="nav_timeout: "+e.message;}',
    // Fallback: poll readyState if waitFor timed out
    'if(loadError){',
    'for(var i=0;i<50;i++){',
    'try{var rs=await session.Runtime.evaluate({expression:"document.readyState",returnByValue:true});if(rs.result&&rs.result.value==="complete"){loadError=null;break;}}catch(ex){}',
    'await new Promise(function(r){setTimeout(r,200);});',
    '}',
    '}',
    // Structured extraction — only after page is ready
    `var r=await session.Runtime.evaluate({expression:${JSON.stringify(extractFunc)},returnByValue:true});`,
    'var result=JSON.parse((r.result&&r.result.value)||"{}");',
    'if(result._error){loadError=result._error;}',
    'if(loadError){result._error=loadError;}',
    `return JSON.stringify(result);`,
    '}finally{',
    'session.closeTab(targetId,sessionId).catch(function(){});',
    '}',
    '})()'
  ].join('\n');
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
  offset: number,
  maxLen: number,
): string {
  const conn = connectCode(port);
  const urlsJson = JSON.stringify(urls);
  const selJson = JSON.stringify(selector);

  // JS snippet for per-tab extraction (uses `tab`, `selector`, `timeoutMs` in scope)
  const extractTabCode = [
    'await session.use(tab.targetId);',
    'let content="";let loadError=null;',
    'try{await Promise.race([',
    '(async()=>{',
    'if(tab.type==="pdf"){',
    'await new Promise(r=>setTimeout(r,3000));',
    'try{const r=await session.Runtime.evaluate({',
    'expression:"document.body?.innerText||document.querySelector(\\"embed\\")?.shadowRoot?.textContent||\\"\\"",',
    'returnByValue:true});',
    'content=(r.result&&r.result.value)||"";',
    'let totalLen=content.length;',
    'let sections=[];',
    'let truncated=maxLen>0&&totalLen>(offset+maxLen);',
    'var dataObj={url:tab.originalUrl||tab.fetchUrl,content:content,truncated,total_length:totalLen,returned_length:content.length,offset,sections:sections};',
    'results.push(dataObj);',
    '}catch(e){loadError="pdf_extraction_failed: "+e.message;results.push({url:tab.originalUrl||tab.fetchUrl,content:"",_error:loadError});}',
    '}else{',
    'const expr="(function(){var root=document.querySelector(\\""+selector+"\\")||document.body;if(!root)return JSON.stringify({content:\\"\\",total_length:0,sections:[]});var fullText=root.innerText||root.textContent||\\"\\";var totalLen=fullText.length;var off="+offset+";var max="+maxLen+";var end=max<0?totalLen:Math.min(off+max,totalLen);var content=off<totalLen?fullText.slice(off,end):\\"\\";var isJunk=off===0&&(content.length<80||/This site can\'t be reached/i.test(content)||/ERR_CONNECTION/i.test(content)||/404 Not Found/i.test(content)||/^\\\\s*$/.test(content)||content===\\"Read More \\\\u00bb\\"||(content.length<100&&content.indexOf(\\"\\\\\\"\\")<0));var headings=root.querySelectorAll(\\"h1,h2,h3\\");var sections=[];for(var i=0;i<headings.length;i++){var h=headings[i];var hText=(h.innerText||\\"\\").trim();if(hText&&hText.length>1){var idx=fullText.indexOf(hText);if(idx>=0){sections.push({heading:hText,level:parseInt(h.tagName[1]),offset:idx});}}}return JSON.stringify({content:isJunk?\\"\\":content,total_length:totalLen,returned_length:content.length,offset:off,truncated:max>=0&&totalLen>(off+max),sections:sections});})()";',
    'var r=await session.Runtime.evaluate({expression:expr,returnByValue:true});',
    'var parsed=JSON.parse((r.result&&r.result.value)||"{}");',
    'var dataObj={url:tab.originalUrl||tab.fetchUrl,content:parsed.content||"",total_length:parsed.total_length||0,returned_length:parsed.returned_length||0,offset:parsed.offset||0,truncated:parsed.truncated||false,sections:parsed.sections||[]};',
    'if(parsed._error)dataObj._error=parsed._error;',
    'results.push(dataObj);',
    '}',
    '})(),',
    'new Promise((_,reject)=>setTimeout(()=>reject(new Error("tab_timeout")),timeoutMs))',
    ']);}catch(e){loadError=e.message;}',
  ].join('');

  return [
    conn,
    'const urls=' + urlsJson + ';',
    'const selector=' + selJson + ';',
    'const timeoutMs=' + timeoutMs + ';',
    'var offset=' + offset + ';',
    'var maxLen=' + maxLen + ';',
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
    'const tab=await session.createTarget({url:"about:blank",background:true});',
    'tabs.push({targetId:tab.targetId,originalUrl:p.originalUrl,fetchUrl:p.fetchUrl,type:p.type,sessionId:tab.sessionId});',
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
    'session.closeTab(tab.targetId,tab.sessionId).catch(function(){});',
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
    'const tab=await session.createTarget({url:"about:blank",background:true});',
    'tabs.push({targetId:tab.targetId,query:q,sessionId:tab.sessionId});',
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
    'session.closeTab(tab.targetId,tab.sessionId).catch(function(){});',
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
    'const {targetId, sessionId}=await session.createTarget({url:"about:blank",background:true});',
    'try{',
    'await session.use(targetId);',
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
    'return r.result.value;',
    '}finally{',
    'session.closeTab(targetId,sessionId).catch(function(){});',
    '}',
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
    'const tab=await session.createTarget({url:"about:blank",background:true});',
    'searchTabs.push({targetId:tab.targetId,query:q,sessionId:tab.sessionId});',
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
    'session.closeTab(tab.targetId,tab.sessionId).catch(function(){});',
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
    'const tab=await session.createTarget({url:"about:blank",background:true});',
    'followTabs.push({targetId:tab.targetId,url:item.url,originalUrl:item.originalUrl,title:item.title,query:item.query,type:item.type,sessionId:tab.sessionId});',
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
    'session.closeTab(tab.targetId,tab.sessionId).catch(function(){});',
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
  const timeoutMs = 60000; // 60s max
  try {
    const result = spawnSync('browser-harness-js', [], {
      input: jsCode,
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024, // 10MB max output
      encoding: 'utf8',
      env: { ...process.env }
    });
    return {
      stdout: (result.stdout || '').trim(),
      stderr: (result.stderr || '').trim(),
      exitCode: result.status ?? -1
    };
  } catch (e: any) {
    return { stdout: '', stderr: `runBrowserHarness error: ${e.message}`, exitCode: -1 };
  }
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
    offset: 0,
    maxLen: 15000,
    pretty: false,
    stream: false,
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
    } else if (arg === '--port' && i + 1 < argv.length) {
      args.port = parseInt(argv[i + 1], 10);
      i += 2;
    } else if (arg === '--offset' && i + 1 < argv.length) {
      args.offset = parseInt(argv[i + 1], 10);
      i += 2;
    } else if (arg === '--max' && i + 1 < argv.length) {
      const val = parseInt(argv[i + 1], 10);
      args.maxPages = val;
      args.maxLen = val;
      i += 2;
    } else if (arg === '--pretty') {
      args.pretty = true;
      i += 1;
    } else if (arg === '--raw') {
      args.raw = true;
      i += 1;
    } else if (arg === '--stream') {
      args.stream = true;
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
  // arXiv normalization
  let url = args.positional[0];
  const pdfMatch = url.match(/(\/pdf\/|\.pdf$)/i);
  if (pdfMatch && pdfMatch[1] === '/pdf/') {
    url = url.replace(/\/pdf\/(.+)/, '/abs/$1').replace(/\.pdf$/, '');
  }

  // ★ Check cache first
  const cached = cacheGet(url, args.offset, args.maxLen);
  if (cached) {
    let output = cached;
    if (args.pretty) {
      try { output = JSON.stringify(JSON.parse(cached), null, 2); } catch(e) {}
    }
    if (args.raw) {
      console.log(output);
    } else {
      console.log(JSON.stringify({ success: true, url, data: output }));
    }
    return;
  }

  const js = followCode(url, args.offset, args.maxLen, args.timeout, args.raw, args.selector, args.port);
  const { stdout, stderr, exitCode } = runBrowserHarness(js);

  if (exitCode !== 0) {
    if (stdout) console.log(stdout);
    else console.log(JSON.stringify({ content: "", total_length: 0, _error: stderr?.trim?.() || "follow_failed" }));
    return;
  }

  // ★ Save to cache
  cacheSet(url, args.offset, args.maxLen, stdout);

  let output = stdout;
  if (args.pretty && stdout) {
    try {
      output = JSON.stringify(JSON.parse(stdout), null, 2);
    } catch(e) {
      output = stdout;
    }
  }

  if (args.raw) {
    console.log(output);
  } else {
    console.log(JSON.stringify({ success: true, url, data: output }));
  }
}

function cmdBatchFollow(args: ParsedArgs): void {
  // Session health check — close stale tabs before starting
  try {
    const connectJs = `return (async function(){
      if(!session.isConnected()){try{await session.connect({port:${args.port}})}catch(e){}}
      if(session.isConnected()){
        var targets=await session.Target.getTargets();
        for(var t of targets.targetInfos||[]){
          if(t.url==="about:blank"||t.url.startsWith("chrome://")||t.url.startsWith("devtools://")) continue;
          try{await session.closeTab(t.targetId,undefined,true);}catch(e){}
        }
      }
      return "ok";
    })()`;
    spawnSync('browser-harness-js', [], { input: connectJs, timeout: 10000, encoding: 'utf8' });
  } catch(e) {}

  // ★ Split URLs into cached (instant) and uncached (fetch)
  const cachedResults: string[] = [];
  const uncachedUrls: string[] = [];
  for (const url of args.positional) {
    const cached = cacheGet(url, args.offset, args.maxLen);
    if (cached) {
      cachedResults.push(cached);
    } else {
      uncachedUrls.push(url);
    }
  }

  let fetchedResults: string[] = [];
  if (uncachedUrls.length > 0) {
    const js = batchFollowCode(
      uncachedUrls,
      args.selector,
      args.timeout,
      args.port,
      args.offset,
      args.maxLen,
    );
    const { stdout, stderr, exitCode } = runBrowserHarness(js);

    if (exitCode !== 0) {
      console.log(JSON.stringify({ success: false, error: 'batch_follow_failed', detail: stderr || stdout || 'unknown error' }));
      return;
    }

    // ★ Parse and cache each result
    try {
      const parsed = JSON.parse(stdout);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          cacheSet(item.url || uncachedUrls[0], args.offset, args.maxLen, JSON.stringify(item));
        }
      }
    } catch(e) {}
    fetchedResults = [stdout];
  }

  // ★ Combine cached + fetched into a single JSON array
  const combined = JSON.stringify([...cachedResults.map(r => { try { return JSON.parse(r); } catch(e) { return { content: r }; } }), ...fetchedResults.flatMap(r => { try { return JSON.parse(r); } catch(e) { return []; } })]);

  let output = combined;
  if (args.pretty) {
    try {
      output = JSON.stringify(JSON.parse(combined), null, 2);
    } catch(e) {
      output = combined;
    }
  }

  console.log(output);
}

function cmdSearch(args: ParsedArgs): void {
  const js = searchCode(args.positional[0], args.count, args.port);
  const { stdout, stderr, exitCode } = runBrowserHarness(js);

  if (exitCode !== 0) {
    const errMsg = stderr || stdout || 'unknown error';
    console.log(JSON.stringify({ success: false, error: 'search_failed', detail: errMsg }));
    return;
  }

  console.log(stdout);
}

function cmdBatchSearch(args: ParsedArgs): void {
  const js = batchSearchCode(args.positional, args.count, args.port);
  const { stdout, stderr, exitCode } = runBrowserHarness(js);

  if (exitCode !== 0) {
    const errMsg = stderr || stdout || 'unknown error';
    console.log(JSON.stringify({ success: false, error: 'batch_search_failed', detail: errMsg }));
    return;
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
    console.log(JSON.stringify({ success: false, error: 'batch_harvest_failed', detail: errMsg }));
    return;
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
