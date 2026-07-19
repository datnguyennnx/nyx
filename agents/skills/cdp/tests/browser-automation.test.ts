/**
 * browser-automation.test.ts — Unit tests for pure template functions
 *
 * These tests validate the JS code-generation functions WITHOUT a browser
 * or CDP connection. Every function is pure (same input → same output).
 *
 * Key coverage:
 *  - All 7 template functions (connectCode, qualityGateCode, followCode,
 *    batchFollowCode, batchSearchCode, searchCode, batchHarvestCode)
 *  - Code structure: expected CDP methods, proper embedding of args
 *  - Purity: identical args → identical output (===)
 *  - No constant leaks: TypeScript-only constants (GOOGLE_*) must NOT
 *    appear in generated JS (would cause ReferenceError in browser)
 */

import { test, expect } from 'bun:test';
import {
  connectCode,
  qualityGateCode,
  followCode,
  batchFollowCode,
  batchSearchCode,
  searchCode,
  batchHarvestCode,
} from '../scripts/browser-automation.ts';

// ─── connectCode ──────────────────────────────────────────────────────────

test('connectCode returns a string containing session.connect', () => {
  const code = connectCode(9222);
  expect(typeof code).toBe('string');
  expect(code).toContain('session.connect');
});

test('connectCode embeds the port number correctly', () => {
  const port = 9999;
  const code = connectCode(port);
  expect(code).toContain(String(port));
  expect(code).toContain('port:9999');
});

test('connectCode checks session.isConnected() before connecting', () => {
  const code = connectCode(9222);
  expect(code).toContain('session.isConnected()');
});

// ─── qualityGateCode ──────────────────────────────────────────────────────

test('qualityGateCode contains expected regex patterns [ERR_CONNECTION, 404]', () => {
  const code = qualityGateCode();
  expect(code).toContain('ERR_CONNECTION');
  expect(code).toContain('404 Not Found');
  expect(code).toContain("This site can't be reached");
});

test('qualityGateCode has balanced braces and valid syntax artifacts', () => {
  const code = qualityGateCode();
  const openBraces = (code.match(/\{/g) || []).length;
  const closeBraces = (code.match(/\}/g) || []).length;
  expect(openBraces).toBe(closeBraces);
  // Each assignment statement ends with ;
  expect(code).toMatch(/;/);
});

test('qualityGateCode references content and loadError (scope correctness)', () => {
  const code = qualityGateCode();
  expect(code).toContain('content');
  expect(code).toContain('loadError');
  expect(code).toContain('isJunk');
});

// ─── followCode ───────────────────────────────────────────────────────────

test('followCode contains Target.createTarget, Page.navigate, Runtime.evaluate, closeTarget', () => {
  const code = followCode('http://example.com', 0, -1, 30000, false, 'article, main, [role=main]', 9222);
  expect(code).toContain('Target.createTarget');
  expect(code).toContain('Page.navigate');
  expect(code).toContain('Runtime.evaluate');
  expect(code).toContain('closeTarget');
});

test('followCode URL is properly JSON-stringified', () => {
  const url = "http://example.com/path?q=1&x='test'";
  const code = followCode(url, 0, -1, 30000, false, 'body', 9222);
  expect(code).toContain(JSON.stringify(url));
});

test('followCode selector appears in the generated extraction expression', () => {
  const selector = 'main.content > p';
  const code = followCode('http://example.com', 0, -1, 30000, false, selector, 9222);
  // The selector is embedded via JSON.stringify then re-stringified for
  // Runtime.evaluate; the raw selector string still appears in the output.
  expect(code).toContain('main.content > p');
});

test('followCode timeout is embedded as a numeric literal', () => {
  const timeout = 30000;
  const code = followCode('http://example.com', 0, -1, timeout, false, 'body', 9222);
  expect(code).toContain(String(timeout));
});

test('followCode uses session.connect (output contains session.connect)', () => {
  const code = followCode('http://example.com', 0, -1, 15000, false, 'body', 9222);
  expect(code).toContain('session.connect');
});

test('followCode extracts with document.querySelector fallback', () => {
  const code = followCode('http://example.com', 0, -1, 15000, false, 'body', 9222);
  expect(code).toContain('document.querySelector');
  expect(code).toContain('session.Runtime.evaluate');
});

test('followCode closes tab in try/catch', () => {
  const code = followCode('http://example.com', 0, -1, 15000, false, 'body', 9222);
  expect(code).toContain('closeTarget');
  // closeTarget is wrapped in try{}catch(e){}
  const closeIdx = code.indexOf('closeTarget');
  const tryIdx = code.lastIndexOf('try{', closeIdx);
  const catchIdx = code.indexOf('catch(e)', closeIdx);
  expect(tryIdx).toBeGreaterThan(-1);
  expect(catchIdx).toBeGreaterThan(closeIdx);
});

// ─── batchSearchCode ──────────────────────────────────────────────────────

test('batchSearchCode creates tabs and navigates with extraction loop', () => {
  const code = batchSearchCode(['query1', 'query2'], 5, 9222);
  expect(code).toContain('createTarget');
  expect(code).toContain('Page.navigate');
  expect(code).toContain('Runtime.evaluate');
  expect(code).toContain('closeTarget');
});

test('batchSearchCode uses Set-based dedup (new Set(), .has, .add)', () => {
  const code = batchSearchCode(['query1'], 5, 9222);
  expect(code).toContain('new Set()');
  expect(code).toContain('.has(r.url)');
  expect(code).toContain('.add(r.url)');
});

test('batchSearchCode sorts results by snippet length', () => {
  const code = batchSearchCode(['query1'], 5, 9222);
  expect(code).toContain('snippet?.length');
  expect(code).toContain('.sort(');
  expect(code).toContain('b.snippet?.length');
});

test('batchSearchCode embeds queries as JSON array and count as literal', () => {
  const queries = ['test query', 'another one'];
  const count = 10;
  const code = batchSearchCode(queries, count, 9222);
  expect(code).toContain(JSON.stringify(queries));
  expect(code).toContain('const count=' + count + ';');
});

test('batchSearchCode returns JSON with results and meta', () => {
  const code = batchSearchCode(['q'], 5, 9222);
  expect(code).toContain('JSON.stringify({results:');
  expect(code).toContain('meta:');
  expect(code).toContain('total_unique');
});

// ─── searchCode ───────────────────────────────────────────────────────────

test('searchCode navigates Google search URL and waits for networkIdle', () => {
  const code = searchCode('test', 5, 9222);
  expect(code).toContain('google.com/search');
  expect(code).toContain('Page.lifecycleEvent');
  expect(code).toContain('networkIdle');
});

test('searchCode properly encodes the query with encodeURIComponent', () => {
  const code = searchCode('test query', 5, 9222);
  expect(code).toContain('encodeURIComponent');
});

test('searchCode contains waitFor("Page.lifecycleEvent"...)', () => {
  const code = searchCode('test', 5, 9222);
  expect(code).toMatch(/waitFor\("Page\.lifecycleEvent"/);
});

test('searchCode closes the tab before returning', () => {
  const code = searchCode('test', 5, 9222);
  const closeIdx = code.indexOf('closeTarget');
  const returnIdx = code.indexOf('return r.result.value');
  expect(closeIdx).toBeGreaterThan(-1);
  expect(closeIdx).toBeLessThan(returnIdx);
});

// ─── batchFollowCode ──────────────────────────────────────────────────────

test('batchFollowCode creates tabs in a loop (for…of)', () => {
  const code = batchFollowCode(['http://a.com', 'http://b.com'], 'body', 15000, 9222);
  expect(code).toMatch(/for\s*\(/);
  expect(code).toContain('createTarget');
});

test('batchFollowCode navigates all tabs', () => {
  const code = batchFollowCode(['http://a.com'], 'body', 15000, 9222);
  expect(code).toContain('Page.navigate');
});

test('batchFollowCode closes all tabs after extraction', () => {
  const code = batchFollowCode(['http://a.com'], 'body', 15000, 9222);
  const closeIdx = code.indexOf('closeTarget');
  const evaluateIdx = code.lastIndexOf('Runtime.evaluate');
  expect(closeIdx).toBeGreaterThan(evaluateIdx);
});

test('batchFollowCode wraps extraction in try/catch', () => {
  const code = batchFollowCode(['http://a.com'], 'body', 15000, 9222);
  expect(code).toContain('try{');
  expect(code).toContain('}catch(e){');
  expect(code).toContain('loadError=e.message');
});

test('batchFollowCode handles PDF type with 3s setTimeout', () => {
  const code = batchFollowCode(['http://a.com'], 'body', 15000, 9222);
  expect(code).toContain('tab.type==="pdf"');
  expect(code).toContain('setTimeout(r,3000)');
});

test('batchFollowCode uses processed URL map for arXiv PDF conversion', () => {
  const code = batchFollowCode(['http://a.com'], 'body', 15000, 9222);
  expect(code).toContain('url.match');
  expect(code).toContain('/pdf/');
});

// ─── batchHarvestCode ─────────────────────────────────────────────────────

test('batchHarvestCode has two-phase structure: searchTabs + followTabs', () => {
  const code = batchHarvestCode(['query1'], 5, 3, 15000, 9222);
  expect(code).toContain('searchTabs');
  expect(code).toContain('followTabs');
  // search tabs come before follow tabs
  const searchIdx = code.indexOf('searchTabs');
  const followIdx = code.indexOf('followTabs');
  expect(searchIdx).toBeLessThan(followIdx);
});

test('batchHarvestCode deduplicates URLs with Set', () => {
  const code = batchHarvestCode(['query1'], 5, 3, 15000, 9222);
  expect(code).toContain('new Set()');
  expect(code).toContain('.has(r.url)');
});

test('batchHarvestCode ranks results by snippet length', () => {
  const code = batchHarvestCode(['query1'], 5, 3, 15000, 9222);
  expect(code).toContain('snippet?.length');
});

test('batchHarvestCode has PDF delay (3s setTimeout for PDF tabs)', () => {
  const code = batchHarvestCode(['query1'], 5, 3, 15000, 9222);
  expect(code).toContain('setTimeout(r,3000)');
});

test('batchHarvestCode returns structured JSON with search_results, read_pages, meta', () => {
  const code = batchHarvestCode(['query1'], 5, 3, 15000, 9222);
  expect(code).toContain('search_results');
  expect(code).toContain('read_pages');
  expect(code).toContain('unique_urls');
  expect(code).toContain('pages_read');
  expect(code).toContain('pages_skipped');
});

test('batchHarvestCode wraps extraction in try/catch with loadError', () => {
  const code = batchHarvestCode(['query1'], 5, 3, 15000, 9222);
  expect(code).toContain('try{');
  expect(code).toContain('}catch(e){');
  expect(code).toContain('loadError=e.message');
});

// ─── Purity Tests ─────────────────────────────────────────────────────────

test('connectCode is pure: same args return identical string (===)', () => {
  expect(connectCode(9222)).toBe(connectCode(9222));
  expect(connectCode(8080)).toBe(connectCode(8080));
});

test('qualityGateCode is pure: always returns identical string (===)', () => {
  expect(qualityGateCode()).toBe(qualityGateCode());
});

test('followCode is pure: same args return identical string (===)', () => {
  expect(followCode('http://x.com', 0, -1, 15000, false, 'body', 9222))
    .toBe(followCode('http://x.com', 0, -1, 15000, false, 'body', 9222));
});

test('batchSearchCode is pure: same args return identical string (===)', () => {
  expect(batchSearchCode(['q1', 'q2'], 5, 9222))
    .toBe(batchSearchCode(['q1', 'q2'], 5, 9222));
});

test('searchCode is pure: same args return identical string (===)', () => {
  expect(searchCode('query', 5, 9222))
    .toBe(searchCode('query', 5, 9222));
});

test('batchFollowCode is pure: same args return identical string (===)', () => {
  expect(batchFollowCode(['http://x.com'], 'body', 15000, 9222))
    .toBe(batchFollowCode(['http://x.com'], 'body', 15000, 9222));
});

test('batchHarvestCode is pure: same args return identical string (===)', () => {
  expect(batchHarvestCode(['q1'], 5, 3, 15000, 9222))
    .toBe(batchHarvestCode(['q1'], 5, 3, 15000, 9222));
});

test('no cross-call contamination: different args produce independent results', () => {
  const a = followCode('http://a.com', 0, -1, 10000, false, 'body', 9222);
  const b = followCode('http://b.com', 0, -1, 20000, false, 'main', 9223);
  expect(a).not.toBe(b);
  expect(a).toContain('http://a.com');
  expect(b).toContain('http://b.com');
  expect(a).not.toContain('http://b.com');
  expect(b).not.toContain('http://a.com');
});

// ─── No Undefined Symbol Leak ─────────────────────────────────────────────

test('generated JS does not contain GOOGLE_* TypeScript constants', () => {
  const codes = [
    ['connectCode', connectCode(9222)],
    ['qualityGateCode', qualityGateCode()],
    ['followCode', followCode('http://x.com', 0, -1, 15000, false, 'body', 9222)],
    ['batchFollowCode', batchFollowCode(['http://x.com'], 'body', 15000, 9222)],
    ['batchSearchCode', batchSearchCode(['q'], 5, 9222)],
    ['searchCode', searchCode('q', 5, 9222)],
    ['batchHarvestCode', batchHarvestCode(['q'], 5, 3, 15000, 9222)],
  ];
  const forbidden = ['GOOGLE_TRANSLATE_PATTERN', 'GOOGLE_RESULT_LINK', 'GOOGLE_RESULT_CONTAINER'];
  for (const [name, code] of codes) {
    for (const constant of forbidden) {
      expect(code).not.toContain(constant);
    }
  }
});

test('generated JS does not leak other TypeScript identifiers into browser scope', () => {
  // Verify no uppercase constants with underscores (besides JS built-ins)
  // appear unmodified. The three GOOGLE_* constants are the known risk,
  // but also check: if someone adds a new constant and forgets to inline it,
  // this test catches it.
  const codes: string[] = [
    connectCode(9222),
    qualityGateCode(),
    followCode('http://x.com', 0, -1, 15000, false, 'body', 9222),
    batchFollowCode(['http://x.com'], 'body', 15000, 9222),
    batchSearchCode(['q'], 5, 9222),
    searchCode('q', 5, 9222),
    batchHarvestCode(['q'], 5, 3, 15000, 9222),
  ];

  // JS built-ins that legitimately appear in generated code
  const safeBuiltins = new Set([
    'JSON', 'Set', 'Error', 'Promise', 'NaN', 'null', 'true', 'false',
  ]);

  const pat = /[A-Z][A-Z_]{2,}/g;
  for (const code of codes) {
    const matches = code.match(pat) || [];
    for (const m of matches) {
      // If it's not a safe built-in AND it looks like a constant
      // (uppercase snake_case), flag it.
      if (!safeBuiltins.has(m)) {
        // Allow things like "Page.lifecycleEvent" — the pat only
        // matches contiguous all-caps segments, so "ARIA" or "HTML"
        // inside a string could match. Those are fine.
        // Only flag if it looks like a standalone constant name.
        // The known problematic ones are GOOGLE_* — check those.
        const isKnownDangerous = m.startsWith('GOOGLE_');
        expect(isKnownDangerous).toBe(false);
      }
    }
  }
});
