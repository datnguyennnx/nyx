/**
 * CDP REPL — HTTP server holding one persistent CDP Session.
 *
 * Endpoints (bind 127.0.0.1:9876 by default; override with $CDP_REPL_PORT):
 *   POST /eval     body = raw JS to evaluate (NOT JSON-wrapped).
 *                  Top-level await supported. Single expression auto-returns.
 *                  Response: {"ok":true,"result":<json>} | {"ok":false,"error":..,"stack"?:..}
 *   GET  /health   {"ok":true,"uptime":<seconds>,"connected":<bool>,"sessionId":<string|null>}
 *   POST /quit     graceful shutdown. Returns {"ok":true} then exits.
 *
 * State: `session`, the active sessionId, event subscribers, and any
 * `globalThis.<name>` you set persist across requests for the lifetime of
 * the process.
 */

import { Session, listPageTargets, resolveWsUrl, detectBrowsers } from './session.ts';
import * as Generated from './generated.ts';

const session = new Session();
(globalThis as any).session = session;
// Bind helpers to the singleton session so the agent calls `listPageTargets()`
// with no args (no host/port confusion, no /json endpoint assumption).
(globalThis as any).listPageTargets = () => listPageTargets(session);
(globalThis as any).resolveWsUrl = resolveWsUrl;
(globalThis as any).detectBrowsers = detectBrowsers;
(globalThis as any).CDP = Generated;

const PORT = Number(process.env.CDP_REPL_PORT ?? 9876);
const startedAt = Date.now();

// ---- Rate limiting (sliding window, per-second counter) ----
// Allow up to 200 requests in any rolling 1-second window.
// This gives generous headroom for bursty single-CLI usage (100 req/s sustained).
const RATE_BURST = 200;
let requestTimes: number[] = [];

function checkRateLimit(): boolean {
  const now = Date.now();
  // Prune timestamps outside the 1-second sliding window
  requestTimes = requestTimes.filter(t => now - t < 1000);
  if (requestTimes.length >= RATE_BURST) return false;
  requestTimes.push(now);
  return true;
}

function isExpression(code: string): boolean {
  const trimmed = code.trim();
  if (!trimmed) return false;
  if (/[;\n]/.test(trimmed)) return false;
  if (/^(let|const|var|if|for|while|do|switch|class|function|throw|try|return|import|export)\b/.test(trimmed)) return false;
  return true;
}

function serializeValue(v: unknown): unknown {
  if (typeof v === 'bigint') return v.toString();
  if (v === null || v === undefined) return v;
  if (Array.isArray(v)) return v.map(serializeValue);
  if (typeof v === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(v as Record<string, unknown>)) {
      result[key] = serializeValue(val);
    }
    return result;
  }
  return v;
}

function serialize(v: unknown): unknown {
  if (v === undefined) return undefined;
  try {
    return serializeValue(v);
  } catch {
    return String(v);
  }
}

async function runSnippet(code: string): Promise<unknown> {
  const body = isExpression(code) ? `return (${code});` : code;
  const wrapped = `(async () => { ${body} })()`;
  return await (0, eval)(wrapped);
}

const TEXT = { 'content-type': 'text/plain; charset=utf-8' } as const;

/**
 * Render a value to the body of a successful /eval response.
 * - undefined / null / "" / {} / []  → empty (caller prints nothing)
 * - string → raw (no JSON quotes)
 * - everything else → JSON
 */
function renderResult(v: unknown): string {
  const s = serialize(v);
  if (s === undefined || s === null) return '';
  if (typeof s === 'string') return s;
  if (Array.isArray(s) && s.length === 0) return '';
  if (typeof s === 'object' && s !== null && Object.keys(s as object).length === 0) return '';
  return JSON.stringify(s);
}

const server = Bun.serve({
  port: PORT,
  hostname: '127.0.0.1',
  async fetch(req) {
    const url = new URL(req.url);

    if (req.method === 'GET' && url.pathname === '/health') {
      return Response.json({
        ok: true,
        uptime: Math.floor((Date.now() - startedAt) / 1000),
        connected: session.isConnected(),
        sessionId: session.getActiveSession() ?? null,
      });
    }

    if (req.method === 'POST' && url.pathname === '/eval') {
      if (!checkRateLimit()) {
        return Response.json({ error: 'rate limit exceeded' }, { status: 429 });
      }
      const code = await req.text();
      if (!code.trim()) {
        return new Response('empty body\n', { status: 400, headers: TEXT });
      }
      try {
        const result = await runSnippet(code);
        const body = renderResult(result);
        return new Response(body, { status: 200, headers: TEXT });
      } catch (e: any) {
        const msg = (e?.stack ?? e?.message ?? String(e)) + '\n';
        return new Response(msg, { status: 500, headers: TEXT });
      }
    }

    if (req.method === 'POST' && url.pathname === '/quit') {
      // Delay shutdown so the response flushes over the wire first.
      setTimeout(() => { server.stop(true); session.close(); process.exit(0); }, 50);
      return Response.json({ ok: true });
    }

    return new Response('not found', { status: 404 });
  },
});

console.log(JSON.stringify({
  ok: true,
  ready: true,
  port: server.port,
  message: `CDP REPL listening on http://127.0.0.1:${server.port}`,
}));
